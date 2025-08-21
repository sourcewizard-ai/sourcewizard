export class JSONSafe {
  static parse(text: string, reviver?: (this: any, key: string, value: any) => any): any | Error {
    try {
      return JSON.parse(text, reviver);
    } catch (error) {
      return error as Error;
    }
  }

  static stringify(value: any, replacer?: (this: any, key: string, value: any) => any | (number | string)[] | null, space?: string | number): any | Error {
    try {
      return JSON.stringify(value, replacer, space);
    } catch (error) {
      return error as Error;
    }
  }
}
