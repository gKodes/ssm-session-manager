interface LeveledLogMethod {
  (message: string, ...meta: any[]): Logger;
  (message: any): Logger;
  (infoObject: object): Logger;
}

interface Logger {
  info: LeveledLogMethod;
  debug: LeveledLogMethod;
}