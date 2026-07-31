const JST_TIME_ZONE = "Asia/Tokyo";

// TZ環境変数の設定有無に依存せず、常にJST基準の日付文字列(YYYY-MM-DD)を返す。
// Date#toISOString()は常にUTCを返すため使用しない。
export function formatJstDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const lookup = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${lookup("year")}-${lookup("month")}-${lookup("day")}`;
}
