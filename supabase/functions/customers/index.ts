import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authenticateRequest } from "../_shared/middleware/auth.ts";
import { authorize, allRoles, adminAndStaff, adminOnly } from "../_shared/middleware/authorize.ts";
import { successResponse, errorResponse, corsResponse } from "../_shared/utils/response.ts";
import { validateCustomer, validateId, validatePagination } from "../_shared/utils/validation.ts";
import { CustomersService } from "./services/customers.service.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    const user = await authenticateRequest(req);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const customerId = pathParts[2];

    const customersService = new CustomersService(user);

    switch (req.method) {
      case "GET": {
        allRoles(user);

        if (customerId) {
          validateId(customerId, "Customer");
          const customer = await customersService.getById(customerId);
          return successResponse(customer);
        }

        const pagination = validatePagination({
          limit: url.searchParams.get("limit"),
          offset: url.searchParams.get("offset"),
        });

        const params = {
          ...pagination,
          orderBy: url.searchParams.get("orderBy") || undefined,
          orderDir: url.searchParams.get("orderDir") || undefined,
        };

        const result = await customersService.getAll(params);
        return successResponse(result);
      }

      case "POST": {
        adminAndStaff(user);

        const createData = await req.json();
        validateCustomer(createData);

        const newCustomer = await customersService.create(createData);
        return successResponse(newCustomer, 201);
      }

      case "PUT": {
        adminAndStaff(user);

        validateId(customerId, "Customer");

        const updateData = await req.json();
        validateCustomer(updateData);

        const updatedCustomer = await customersService.update(customerId!, updateData);
        return successResponse(updatedCustomer);
      }

      case "DELETE": {
        adminOnly(user);

        validateId(customerId, "Customer");

        await customersService.delete(customerId!);
        return successResponse({ deleted: true });
      }

      default:
        return errorResponse(new Error("Method not allowed"), 405);
    }
  } catch (error) {
    console.error("Error in customers endpoint:", error);
    return errorResponse(error as Error);
  }
});
