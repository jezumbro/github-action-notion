import { describe, expect, test } from "vitest";
import { buildHeaderFromProperties, parseProperty } from "../src/notion";

describe("property parsing", () => {
  const properties = {
    tags: { id: "%3EnuZ", type: "multi_select", multi_select: [] },
    "Created time": {
      id: "pg%5C%5D",
      type: "created_time",
      created_time: "2024-12-30T13:33:00.000Z",
    },
    Status: {
      id: "ydqt",
      type: "status",
      status: {
        id: "72c470fa-7a71-4f9e-bc0f-70a087f8103d",
        name: "Not started",
        color: "default",
      },
    },
    title: {
      id: "title",
      type: "title",
      title: [
        {
          type: "text",
          text: { content: "a title", link: null },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
          plain_text: "A title",
          href: null,
        },
      ],
    },
    "Published Date": {
      id: "61cfad71-5b84-469e-b840-b8c07bdc0944",
      type: "date",
      date: { start: "2024-12-09", end: null, time_zone: null },
    },
  };

  test.each([
    ["title", "A title"],
    ["Created time", "2024-12-30T13:33:00.000Z"],
    ["Published Date", "2024-12-09"],
    ["unknown", undefined],
  ])("parseProperty(%s)=%s", (property, expected) => {
    expect(parseProperty(properties[property])).toEqual(expected);
  });
  test("parseProperty(text)=text content", () => {
    const output = parseProperty({
      id: "name",
      type: "text",
      text: {
        content: "text content",
        link: null,
      },
    });
    expect(output).toEqual("text content");
  });

  describe("buildHeaderFromProperties", () => {
    test("default set", () => {
      const output = buildHeaderFromProperties(properties);
      expect(output).toEqual(
        "---\ncreatedTime: 2024-12-30T13:33:00.000Z\npublishedDate: 2024-12-09\nstatus: Not started\ntitle: A title\n---\n",
      );
    });
    test("with date instead of string", () => {
      const now = new Date();
      const output = buildHeaderFromProperties({
        foo: {
          type: "date",
          date: { start: now },
        },
      });
      expect(output).toEqual(`---\nfoo: ${now.toISOString()}\n---\n`);
    });
    test.each([undefined, {}])("(%s)", (prop) => {
      const output = buildHeaderFromProperties(prop);
      expect(output).toEqual("");
    });
  });
});
