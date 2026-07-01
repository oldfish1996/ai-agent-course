// 实战：智能导入数据

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import mysql, { OkPacket } from "mysql2/promise";

const model = new ChatOpenAI({
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const friendSchema = z.object({
  name: z.string().describe("姓名"),
  gender: z.string().describe("性别（男/女）"),
  birth_date: z
    .string()
    .describe("出生日期，格式：YYYY-MM-DD，如果无法确定具体日期，根据年龄估算"),
  company: z.string().nullable().describe("公司名称，如果没有则返回 null"),
  title: z.string().nullable().describe("职位/头衔，如果没有则返回 null"),
  phone: z.string().nullable().describe("手机号，如果没有则返回 null"),
  wechat: z.string().nullable().describe("微信号，如果没有则返回 null"),
});

const friendsArraySchema = z.array(friendSchema).describe("好友信息数组");

const structuredModel = model.withStructuredOutput(friendsArraySchema);

const connectionConfig = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "admin",
  multipleStatements: true,
};

async function extractAndInsert(text: string) {
  const connection = await mysql.createConnection(connectionConfig);

  try {
    await connection.query(`USE hello;`);

    console.log("正在从文本中提取信息...");
    const prompt = `请从以下文本中提取所有好友信息，文本中可能包含一个或多个人的信息。请将每个人的信息分别提取出来，返回一个数组。

      ${text}

      要求：
      1. 如果文本中包含多个人，请为每个人创建一个对象
      2. 每个对象包含以下字段：
        - 姓名：提取文本中的人名
        - 性别：提取性别信息（男/女）
        - 出生日期：如果能找到具体日期最好，否则根据年龄描述估算（格式：YYYY-MM-DD）
        - 公司：提取公司名称
        - 职位：提取职位/头衔信息
        - 手机号：提取手机号码
        - 微信号：提取微信号
      3. 如果某个字段在文本中找不到，请返回 null
      4. 返回格式必须是一个数组，即使只有一个人也要放在数组中`;

    const results = await structuredModel.invoke(prompt);

    console.log(`✅ 提取到 ${results.length} 个好友信息`);
    console.log(results);
    if (results.length === 0) {
      console.log("⚠️ 没有提取到任何好友信息");
      return { count: 0, insertIds: [] };
    }

    // 批量插入数据库
    const insertSql = `
      INSERT INTO friends (
        name,
        gender,
        birth_date,
        company,
        title,
        phone,
        wechat
      ) VALUES ?;
    `;

    const values = results.map((friend) => [
      friend.name,
      friend.gender,
      friend.birth_date || null,
      friend.company,
      friend.title,
      friend.phone,
      friend.wechat,
    ]);

    const [insertResult] = await connection.query<OkPacket>(insertSql, [
      values,
    ]);
    console.log(`✅ 插入 ${insertResult.affectedRows} 条好友信息`);
    console.log(
      `插入的ID范围：${insertResult.insertId} - ${insertResult.insertId + insertResult.affectedRows - 1}`,
    );
    return {
      count: insertResult.affectedRows,
      insertIds: results.map((_friend, index) => insertResult.insertId + index),
    };
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await connection.end();
  }
}

async function main() {
  const sampleText = `我最近认识了几个新朋友。第一个是张总，女的，看起来30出头，
    在腾讯做技术总监，手机13800138000，微信是zhangzong2024。第二个是李工，男，大概28岁，
    在阿里云做架构师，电话15900159000，微信号lee_arch。还有一个是陈经理，女，35岁左右，
    在美团做产品经理，手机号是18800188000，微信chenpm2024。
  `;

  console.log(`输入文本：${sampleText}`);

  try {
    const result = await extractAndInsert(sampleText);
    console.log(`🎉 处理完成！成功插入 ${result.count} 条好友信息`);
    console.log(`插入的ID：${result.insertIds.join(", ")}`);
  } catch (error) {
    console.error("错误:", error);
    process.exit(1);
  }
}

main();
