import "dotenv/config.js";
import { Notion } from "../src/notion.js";

const rootPageId = process.env.NOTION_ROOT_PAGE_ID;
const notion = new Notion(process.env.NOTION_TOKEN);

(async () => {
  await notion.outputPages("./_posts/", rootPageId, 5);
})();
