import db from "../db/connection";

export const selectUserPayments = async (userId: string) => {
  const { rows } = await db.query(
    "SELECT * FROM stripe_payments WHERE user_id = $1",
    [userId]
  );
  if (rows.length === 0) {
    return Promise.reject({ status: 404, message: "No payments found" });
  }
  return rows;
};
