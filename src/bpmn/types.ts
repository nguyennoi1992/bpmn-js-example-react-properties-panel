export type IdValue = string | number;

export interface FunctionItem {
  ID: IdValue;
  NAME?: string;
}

export interface ModuleItem {
  ID: IdValue;
  NAME?: string;
  children?: FunctionItem[];
}

export interface FlatFunctionItem {
  id: IdValue;
  className: string;
  displayName: string;
  moduleId: IdValue;
  moduleName: string;
}
