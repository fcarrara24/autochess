declare module 'ecstatic' {
  interface Options {
    root?: string;
    showDir?: boolean;
    autoIndex?: boolean;
  }
  
  function ecstatic(options: Options): (req: any, res: any) => void;
  namespace ecstatic {}
  export = ecstatic;
}
