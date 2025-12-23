
import { createContext } from 'react';



export type ISocket = {

  on: (event: string, cb: (...args: any[]) => void) => void;

  off: (event: string, cb?: (...args: any[]) => void) => void;

  emit: (event: string, ...args: any[]) => void;

  once?: (event: string, cb: (...args: any[]) => void) => void;

};



export const SocketContext = createContext<ISocket>({

  on: () => {},

  off: () => {},

  emit: () => {},

  once: () => {},

});
