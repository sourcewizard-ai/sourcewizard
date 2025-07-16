import { detectRepo } from "../shared/repository-detector.js";

interface Task {
  name: string;
  prompt: string;
}

interface Agent {
  name: string;
  tasks: Task[];
}

function search() {
  // find intent via semantic search
}

export async function install(name: string) {
  const repo = await detectRepo();
  console.log(repo);
  // determine repo language, framework
  // get config and installation prompt
  // get relevant files
  // install packages
  // run llm with relevant files to make changes
}

export { detectRepo };
