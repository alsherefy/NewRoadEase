import { JWTPayload, NotFoundError, PaginatedResponse } from "../../_shared/types.ts";
import { getSupabaseClient } from "../../_shared/utils/supabase.ts";
import { applyRoleBasedFilter, getOrganizationId } from "../../_shared/services/queryFilters.ts";

export class CustomersService {
  private supabase = getSupabaseClient();

  constructor(private user: JWTPayload) {}

  async getAll(params: { limit: number; offset: number; orderBy?: string; orderDir?: string }): Promise<PaginatedResponse<any>> {
    let query = this.supabase
      .from("customers")
      .select("*", { count: "exact" });

    query = applyRoleBasedFilter(query, this.user, 'customers');

    const orderBy = params.orderBy || "created_at";
    const orderDir = params.orderDir || "desc";

    const { data, error, count } = await query
      .order(orderBy, { ascending: orderDir === "asc" })
      .range(params.offset, params.offset + params.limit - 1);

    if (error) throw new Error(error.message);

    return {
      data: data || [],
      count: count || 0,
      hasMore: params.offset + params.limit < (count || 0),
    };
  }

  async getById(id: string): Promise<any> {
    let query = this.supabase
      .from("customers")
      .select("*")
      .eq("id", id);

    query = applyRoleBasedFilter(query, this.user, 'customers');

    const { data, error } = await query.maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundError("Customer not found");

    return data;
  }

  async create(customerData: any): Promise<any> {
    const dataWithOrg = {
      ...customerData,
      organization_id: getOrganizationId(this.user, customerData.organization_id),
    };

    const { data, error } = await this.supabase
      .from("customers")
      .insert(dataWithOrg)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, customerData: any): Promise<any> {
    await this.getById(id);

    const { organization_id, ...updateData } = customerData;

    const { data, error } = await this.supabase
      .from("customers")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);

    const { error } = await this.supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);
  }
}
