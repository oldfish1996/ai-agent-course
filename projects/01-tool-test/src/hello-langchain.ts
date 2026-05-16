import { ChatOpenAI } from "@langchain/openai";
import dotenv from 'dotenv';

dotenv.config();

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.MODEL_NAME,
  // temperature: 0.7,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const response = await model.invoke("介绍下自己");
console.log(response.content);
