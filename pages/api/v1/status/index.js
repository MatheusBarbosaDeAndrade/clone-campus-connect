import database from "../../../../infra/database.js";

async function status(resquest, response) {
  const result = await database.query("SELECT 1+1 AS SUM;");
  console.log(result.rows);
  response.status(200).json({ status: "200" });
}

export default status;
