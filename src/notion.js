import { Client, LogLevel } from "@notionhq/client";
import { camelCase } from "change-case";
import { existsSync, mkdirSync, writeFile } from "fs";
import * as util from "node:util";
import { NotionToMarkdown } from "notion-to-md";

export class Notion {
  constructor(notionToken) {
    this.pages = [];
    this.notionPages = [];
    this.notionClient = new Client({
      auth: notionToken,
      logLevel: LogLevel.ERROR,
    });
    this.n2m = new NotionToMarkdown({ notionClient: this.notionClient });
  }

  async getMarkdownByPageId(pageId) {
    const mdblocks = await this.n2m.pageToMarkdown(pageId);
    return this.n2m.toMarkdownString(mdblocks);
  }

  async outputPages(dir, rootPageId) {
    let search = await this.getPages();
    let results = search.results;
    this.notionPages = this.notionPages.concat(results);
    while (results.length === 100) {
      search = await this.getPages(results[99].id);
      results = search.results;
      this.notionPages = this.notionPages.concat(results);
    }

    for (const p of this.notionPages) {
      const parent = await this.getParentPage(p, this.notionPages);
      const page = convertPage(p);
      if (parent) {
        page.parentId = parent.id;
        page.parentType = "page";
      }
      this.pages.push(page);
    }

    // set the relationship of pages
    const rootPages = this.pages.filter((p) => p.parentId === rootPageId);
    for (const rootPage of rootPages) {
      this.setChildPages(rootPage);
    }

    if (!dir) {
      dir = "./_posts/";
    }
    if (!existsSync(dir)) {
      mkdirSync(dir);
    }
    let contentPages = this.pages.filter(
      (page) => !page.children || page.children.length === 0,
    );
    for (const page of contentPages) {
      const pageContent = await this.getMarkdownByPageId(page.id);
      if (pageContent?.parent) {
        const filename = `${page.createdAt.getFullYear()}-${(
          page.createdAt.getMonth() + 1
        )
          .toString()
          .padStart(2, "0")}-${page.createdAt
          .getDate()
          .toString()
          .padStart(2, "0")}-${page.pathname}.md`;
        let header = buildHeaderFromProperties(page.properties);
        writeFile(`${dir}/${filename}`, header + pageContent.parent, (err) => {
          if (err) {
            console.log("============ ERROR =============");
            console.log(err);
          }
        });
      }
    }
  }

  async getPages(prePaginationItem) {
    const searchParams = {
      sort: {
        timestamp: "last_edited_time",
        direction: "ascending",
      },
      // query?: string,
      page_size: 100, // The max value is 100
      filter: {
        property: "object",
        value: "page",
      },
    };
    if (prePaginationItem) {
      searchParams.start_cursor = prePaginationItem;
    }
    return await this.notionClient.search(searchParams);
  }

  setChildPages(currentPage) {
    currentPage.children = this.pages.filter(
      (page) => page.parentId === currentPage.id,
    );
    for (const childPage of currentPage.children) {
      childPage.parentIds = [currentPage.id].concat(
        currentPage.parentIds || [],
      );
      childPage.categories.push(...currentPage.categories, currentPage.title);
      childPage.tags = childPage.categories;
      this.setChildPages(childPage);
    }
  }

  async getParentPage(curPageOrBlock, existingPages) {
    if (curPageOrBlock?.parent?.type) {
      const type = curPageOrBlock?.parent?.type.replace("_id", "");
      const parent = await this.getParent(
        type,
        curPageOrBlock.parent[curPageOrBlock.parent.type],
        existingPages,
      );
      if (parent && parent["object"] === "page") {
        return Promise.resolve(parent);
      } else {
        return await this.getParentPage(parent, existingPages);
      }
    }
    return Promise.resolve(null);
  }

  async getParent(type, id, existingPages) {
    switch (type) {
      case "block":
        return await this.notionClient.blocks.retrieve({
          block_id: id,
        });

      case "page":
        const page = existingPages.find((p) => p.id === id);
        if (page) {
          return Promise.resolve(page);
        } else {
          return await this.notionClient.pages.retrieve({
            page_id: id,
          });
        }

      default:
        return Promise.resolve(null);
    }
  }
}
const convertPage = (page) => {
  const title = parseProperty(page.properties?.title);
  let pagePath = page.url.substring(+page.url.lastIndexOf("/") + 1);
  pagePath = pagePath.substring(0, pagePath.length - 32 - 1);
  return {
    ...page,
    idWithoutSeparator: page.id.replace("-", ""),
    createdAt: new Date(page.created_time),
    lastUpdatedAt: new Date(page.last_edited_time),
    url: page.url,
    pathname: (pagePath || "").toLowerCase(),
    title: title,
  };
};

const lookup = {
  created_time: (property) => property.created_time,
  date: (property) => {
    const date = property.date?.start;
    if (util.types.isDate(date)) {
      return date.toISOString();
    }
    return date;
  },
  multi_select: (property) =>
    property.multi_select
      .map((p) => p.name)
      .sort((a, b) => a.localeCompare(b))
      .join(","),
  status: (property) => property.status.name,
  text: (property) => property.text.content,
  title: (property) => {
    const titles = property.title;
    return titles && Array.isArray(titles)
      ? titles
          .filter((t) => t.type === "text")
          .map((t) => t.plain_text)
          .join("")
      : "";
  },
};
export const parseProperty = (property) => {
  const propertyType = property?.type;
  if (propertyType in lookup) {
    return lookup[propertyType](property);
  }
};
export const buildHeaderFromProperties = (properties) => {
  console.log(JSON.stringify(properties));
  if (!properties || !Object.keys(properties).length) return "";
  let header = "---\n";
  Object.entries(properties)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, property]) => {
      const formattedKey = camelCase(key);
      const value = parseProperty(property);
      if (value) {
        header += `${formattedKey}: ${value}\n`;
      } else {
        console.error(
          `unknown property type for ${formattedKey}: ${property?.type}`,
        );
      }
    });
  header += "---\n";
  return header;
};
