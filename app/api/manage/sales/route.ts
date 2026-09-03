import { requireStaff } from "@/lib/server/auth";
import { finalizeSale, saleSchema } from "@/lib/server/sales";

export async function POST(request: Request) {
  try {
    const employee = await requireStaff(request, "SALES");
    const parsed = saleSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid sale data.", fields: parsed.error.flatten() }, { status: 400 });
    return Response.json(await finalizeSale(parsed.data, employee.uid), { status: 201 });
  } catch (error) { return error instanceof Response ? error : Response.json({ error: error instanceof Error ? error.message : "Sale could not be completed." }, { status: 400 }); }
}
