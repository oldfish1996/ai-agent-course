import { RunnablePick} from "@langchain/core/runnables";

const pick = new RunnablePick("name");
const pick2 = new RunnablePick(["name", "age"]);

const res = await pick.invoke({name: "chen", age: 25});
console.log(res);
const res2 = await pick2.invoke({name: "chen", age: 25, sex: "male"});
console.log(res2);
