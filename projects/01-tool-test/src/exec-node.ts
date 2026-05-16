import { spawn } from "node:child_process";

const command = 'echo -e "n\nn" | pnpm create vite react-todo-app --template react-ts';
const cwd = process.cwd();

const [cmd, ...args] = command.split(" ");

const child = spawn(cmd, args, {
  cwd,
  stdio: "inherit", // 实时输出到控制台
  shell: true,
});

let errMessage = "";

child.on("error", (error) => {
  // console.error(`子进程错误: ${error.message}`);
  errMessage = error.message;
});

child.on("close", (code) => {
  if (code === 0) {
    process.exit(0);
  } else {
    if (errMessage) {
      console.error(`子进程错误: ${errMessage}`);
    }
    process.exit(code || 1);
  }
});
