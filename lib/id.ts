import { supabase } from "../supabaseClient";

/**
 * Generates a formatted, sequential ID for various document types.
 * Format: PREFIX-YYYYMMDD-####
 *
 * @param prefix - The prefix for the ID (e.g., 'LTN-SC', 'LTN-BH', 'LTN-NK').
 * @returns A promise that resolves to the formatted ID string.
 */
export const generateFormattedId = async (prefix: string): Promise<string> => {
  try {
    // 1. Get the current date in YYYYMMDD format.
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const datePart = `${year}${month}${day}`;

    // 2. Try to get sequence from Supabase RPC function
    try {
      const { data: sequence, error } = await supabase.rpc(
        "get_next_daily_sequence",
        {
          p_prefix: prefix,
        }
      );

      if (!error && sequence) {
        // Success! Format the sequence number to be 4 digits
        const sequencePart = sequence.toString().padStart(4, "0");
        const formattedId = `${prefix}-${datePart}-${sequencePart}`;
        console.log("✅ Generated ID via RPC:", formattedId);
        return formattedId;
      }
    } catch (rpcError) {
      console.warn("RPC not available, using fallback method:", rpcError);
    }

    // 3. Fallback: Query pin_sales.code for today and increment
    const todayPrefix = `${prefix}-${datePart}`;
    const { data: existingCodes, error: queryError } = await supabase
      .from("pin_sales")
      .select("code")
      .ilike("code", `${todayPrefix}%`)
      .order("code", { ascending: false })
      .limit(1);

    if (!queryError && existingCodes && existingCodes.length > 0) {
      // Extract the sequence number from the last code
      const lastCode = (existingCodes[0] as any).code as string;
      const match = lastCode?.match(/-(\d{4})$/);
      if (match) {
        const lastSeq = parseInt(match[1], 10);
        const nextSeq = (lastSeq + 1).toString().padStart(4, "0");
        const formattedId = `${prefix}-${datePart}-${nextSeq}`;
        console.log("✅ Generated ID via pin_sales query:", formattedId);
        return formattedId;
      }
    }

    // 4. First ID of the day
    const formattedId = `${prefix}-${datePart}-0001`;
    console.log("✅ Generated first ID of day:", formattedId);
    return formattedId;
  } catch (err) {
    console.error("❌ Error in generateFormattedId:", err);
    // Ultimate fallback: use timestamp
    const now = new Date();
    const datePart = `${now.getFullYear()}${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;
    return `${prefix}-${datePart}-${Date.now().toString().slice(-4)}`;
  }
};
