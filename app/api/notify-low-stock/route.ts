import { NextResponse } from "next/server";

type LowStockItem = {
  productName?: string;
  productId?: string;
  outletId?: string;
  currentQuantity?: number;
  minQuantity?: number;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items: LowStockItem[] = body.products || (body.product ? [body.product] : [body]);

    const results: any[] = [];
    const toNumber = process.env.NOTIFY_PHONE || "03456789123";

    for (const item of items) {
      const productName = item.productName || "product";
      const productId = item.productId || "";
      const outletId = item.outletId || "";
      const currentQuantity = item.currentQuantity ?? 0;
      const minQuantity = item.minQuantity ?? 0;

      const message = `Low stock alert: ${productName} (${productId}) at outlet ${outletId} has ${currentQuantity} units (min ${minQuantity}).`;

      const sid = process.env.TWILIO_SID;
      const auth = process.env.TWILIO_AUTH;
      const from = process.env.TWILIO_FROM;

      if (sid && auth && from) {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
        const params = new URLSearchParams();
        params.append("From", from);
        params.append("To", toNumber);
        params.append("Body", message);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Twilio send failed:", text);
          results.push({ ok: false, error: text });
          continue;
        }
        results.push({ ok: true });
      } else {
        // No Twilio configured - fallback to logging
        console.log("Low stock alert (logged):", message, "->", toNumber);
        results.push({ ok: true, note: "logged-only" });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error("notify-low-stock error", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
