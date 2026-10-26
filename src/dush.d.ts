declare module 'dush' {
  interface DushEmitter {
    on(event: string, handler: (...args: any[]) => void): DushEmitter;
    off(event: string, handler: (...args: any[]) => void): DushEmitter;
    emit(event: string, ...args: any[]): DushEmitter;
  }

  function dush(): DushEmitter;
  export default dush;
}
