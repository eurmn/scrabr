import { Server as NetServer, Socket } from 'net';
import { NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import {SVGProps} from 'react';

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export type NextApiResponseServerIo = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};

export type BaseUser = {
  id: string;
  username: string;
  ready: boolean;
  score: number;
};

export type ServerUser = {
  joinedAt: Date;
  rack: string[];
} & BaseUser;

export type BaseGameState = {
  board: Board;
  turn?: string | null;
  gameStarted: boolean;
  users: BaseUser[],
  roomCode?: string;
  winner?: string;
  wordsCreated: string[]
};

export type ClientGameState = {
  rack: ScrabbleCard[],
  currentPlayScore: number,
  remainingTiles: number,
  newUser?: boolean,
  newReady?: boolean,
} & BaseGameState;

export type Bag = {
  total: number,
  a: number,
  e: number,
  i: number,
  o: number,
  s: number,
  u: number,
  m: number,
  r: number,
  t: number,
  d: number,
  l: number,
  c: number,
  ç: number,
  p: number,
  n: number,
  b: number,
  f: number,
  g: number,
  h: number,
  v: number,
  j: number,
  q: number,
  x: number,
  z: number,
  '_': number, // blank card
};

export type ScrabbleCard = {
  letter: string,
  id: string
}

export type Rack = ScrabbleCard[];

export type Board = string[][];