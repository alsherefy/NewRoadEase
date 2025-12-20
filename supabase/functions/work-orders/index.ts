import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authenticateRequest } from "../_shared/middleware/auth.ts";
import { allRoles, adminAndCustomerService, adminOnly, checkOwnership } from "../_shared/middleware/authorize.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { validateUUID, validatePagination, validateRequestBody } from "../_shared/utils/validation.ts";
import { RESOURCES } from "../_shared/constants/resources.ts";
import { createClient } from "../_shared/utils/supabase.ts";
import { ApiError } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const user = await authenticateRequest(req);
    const supabase = createClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const workOrderId = pathParts[pathParts.length - 1] !== 'work-orders' ? pathParts[pathParts.length - 1] : undefined;

    switch (req.method) {
      case "GET": {
        allRoles(user);

        if (workOrderId) {
          validateUUID(workOrderId, "Work Order ID");

          const { data, error } = await supabase
            .from("work_orders")
            .select(`
              *,
              customer:customers(id, name, phone, email),
              vehicle:vehicles(id, car_make, car_model, plate_number, year, vin, color),
              services:work_order_services(
                *,
                assignments:technician_assignments(
                  *,
                  technician:technicians(id, name, specialization)
                )
              ),
              spare_parts:work_order_spare_parts(
                *,
                spare_part:spare_parts(id, name, part_number)
              )
            `)
            .eq("id", workOrderId)
            .eq("organization_id", user.organizationId)
            .maybeSingle();

          if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
          if (!data) throw new ApiError("Work order not found", "NOT_FOUND", 404);
          return successResponse(data);
        }

        const pagination = validatePagination({
          limit: url.searchParams.get("limit"),
          offset: url.searchParams.get("offset"),
        });

        const orderBy = url.searchParams.get("orderBy") || "created_at";
        const orderDir = url.searchParams.get("orderDir") || "desc";
        const status = url.searchParams.get("status");

        let query = supabase
          .from("work_orders")
          .select(`
            id,
            order_number,
            customer_id,
            vehicle_id,
            status,
            priority,
            total_labor_cost,
            created_at,
            updated_at,
            customer:customers!inner(id, name, phone),
            vehicle:vehicles!inner(id, car_make, car_model, plate_number)
          `, { count: "exact" })
          .eq("organization_id", user.organizationId);

        if (status) {
          query = query.eq("status", status);
        }

        const { data, error, count } = await query
          .order(orderBy, { ascending: orderDir === "asc" })
          .range(pagination.offset, pagination.offset + pagination.limit - 1);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);

        return successResponse({
          data: data || [],
          count: count || 0,
          hasMore: pagination.offset + pagination.limit < (count || 0),
        });
      }

      case "POST": {
        adminAndCustomerService(user);

        const body = await validateRequestBody(req, ["customer_id", "vehicle_id", "description"]);
        const { services, spare_parts, ...workOrderData } = body;

        const { data: orderNumber } = await supabase.rpc("generate_work_order_number");

        const { data: workOrder, error: workOrderError } = await supabase
          .from("work_orders")
          .insert({
            ...workOrderData,
            order_number: orderNumber,
            organization_id: user.organizationId,
          })
          .select()
          .single();

        if (workOrderError) throw new ApiError(workOrderError.message, "DATABASE_ERROR", 500);

        if (services && services.length > 0) {
          for (const service of services) {
            const { technicians, ...serviceData } = service;
            const { data: insertedService, error: serviceError } = await supabase
              .from("work_order_services")
              .insert({ ...serviceData, work_order_id: workOrder.id })
              .select()
              .single();

            if (serviceError) throw new ApiError(serviceError.message, "DATABASE_ERROR", 500);

            if (technicians && technicians.length > 0) {
              const assignments = technicians.map((t: any) => ({
                service_id: insertedService.id,
                technician_id: t.technician_id,
                share_percentage: t.share_percentage,
                share_amount: (serviceData.price * t.share_percentage) / 100,
              }));

              const { error: assignError } = await supabase
                .from("technician_assignments")
                .insert(assignments);

              if (assignError) throw new ApiError(assignError.message, "DATABASE_ERROR", 500);
            }
          }
        }

        if (spare_parts && spare_parts.length > 0) {
          const partsToInsert = spare_parts.map((sp: any) => ({
            work_order_id: workOrder.id,
            spare_part_id: sp.spare_part_id,
            quantity: sp.quantity,
            unit_price: sp.unit_price,
          }));

          const { error: partsError } = await supabase
            .from("work_order_spare_parts")
            .insert(partsToInsert);

          if (partsError) throw new ApiError(partsError.message, "DATABASE_ERROR", 500);

          for (const sp of spare_parts) {
            await supabase.rpc("decrease_spare_part_quantity", {
              p_spare_part_id: sp.spare_part_id,
              p_quantity: sp.quantity,
            });
          }
        }

        return successResponse(workOrder, 201);
      }

      case "PUT": {
        adminAndCustomerService(user);
        validateUUID(workOrderId, "Work Order ID");

        await checkOwnership(user, RESOURCES.WORK_ORDERS, workOrderId!);

        const body = await req.json();
        const { data, error } = await supabase
          .from("work_orders")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", workOrderId)
          .eq("organization_id", user.organizationId)
          .select()
          .single();

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse(data);
      }

      case "DELETE": {
        adminOnly(user);
        validateUUID(workOrderId, "Work Order ID");

        await checkOwnership(user, RESOURCES.WORK_ORDERS, workOrderId!);

        const { data: services } = await supabase
          .from("work_order_services")
          .select("id")
          .eq("work_order_id", workOrderId);

        if (services && services.length > 0) {
          const serviceIds = services.map(s => s.id);
          await supabase
            .from("technician_assignments")
            .delete()
            .in("service_id", serviceIds);
        }

        await supabase.from("work_order_services").delete().eq("work_order_id", workOrderId);
        await supabase.from("work_order_spare_parts").delete().eq("work_order_id", workOrderId);

        const { error } = await supabase
          .from("work_orders")
          .delete()
          .eq("id", workOrderId)
          .eq("organization_id", user.organizationId);

        if (error) throw new ApiError(error.message, "DATABASE_ERROR", 500);
        return successResponse({ deleted: true });
      }

      default:
        return errorResponse(new Error("Method not allowed"), 405);
    }
  } catch (error) {
    console.error("Error in work-orders endpoint:", error);
    return errorResponse(error as Error);
  }
});
