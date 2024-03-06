import { Server as NetServer } from 'http';
import { NextApiRequest } from 'next';
import { Server as ServerIO } from 'socket.io';

import { db } from '@/drizzle';
import { rooms, users } from '@/drizzle/schema';
import { ClientGameState, NextApiResponseServerIo, ScrabbleCard } from '@/types';
import { drawLetter, filterWords, findWordsOnBoard, generateCombinations, generateEmptyBoard, generateNewBag, generateNewRack, getScoreOfWord, hasLooseTile, isEmptyTile } from '@/utils';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import { type Nodehun as NodehunType } from 'nodehun';
// @ts-expect-error wil complain about importing a .node file
import { Nodehun } from 'nodehun/build/Release/Nodehun.node';

console.log('Loading affix...');
const affix = fs.readFileSync('dict/index.aff');
console.log('Loading dict...');
const dictionary = fs.readFileSync('dict/index.dic');
console.log('Loaded dictionary');

export const config = {
  api: {
    bodyParser: false,
  },
};

type CreateRoomArgs = {
  username: string;
};

type JoinRoomArgs = {
  username: string;
  id: string;
}

type PlayArgs = {
  play: string[];
  roomCode: string;
}

const ioHandler = async (req: NextApiRequest, res: NextApiResponseServerIo) => {
  if (!res.socket.server.io) {
    console.log('initializing nodehun');
    const dict: NodehunType = new Nodehun(affix, dictionary);
    console.log('initialized nodehun');

    const path = '/api/game';
    const httpServer: NetServer = res.socket.server as unknown as NetServer;
    const io = new ServerIO(httpServer, {
      path: path,
      addTrailingSlash: false,
    });

    io.on('connection', (socket) => {
      socket.join(socket.id);

      socket.on('join-room', async ({ username, id }: JoinRoomArgs) => {
        await socket.join(id);

        // check if room exists
        const room = (
          await db.query.rooms.findFirst({
            where: eq(rooms.id, id),
            with: {
              users: true
            }
          })
        );

        if (!room) {
          socket.emit('error', 'join-room');
          return;
        }

        const user = (
          await db.insert(users).values({
            id: socket.id,
            username,
            roomId: id,
            joinedAt: new Date()
          }).returning()
        )[0];

        const { users: roomUsers, board, gameStarted } = room;
        
        io.to(id).emit('gamestate', {
          roomCode: id,
          board,
          gameStarted,
          users: [...roomUsers, user].map(({ id, ready, username, score }) => ({ id, ready, username, score })),
          newUser: true
        });
      });

      socket.on('create-room', async ({ username }: CreateRoomArgs) => {
        // create 6 digit room code with lowercase and uppercase letters and numbers
        const id = Math.random().toString(36).substring(2, 8).toUpperCase();
        const board = generateEmptyBoard();
        const gameStarted = false;
 
        await db.insert(rooms).values({
          id,
          board,
          createdAt: new Date(),
          gameStarted
        });

        const user = {
          id: socket.id,
          username,
          roomId: id,
          joinedAt: new Date()
        };
        
        await db.insert(users).values(user);

        await socket.join(id);

        socket.emit('gamestate', {
          roomCode: id,
          board,
          gameStarted,
          users: [{ ...user, ready: false }],
          newUser: true
        });
      });

      socket.on('toggle-ready', async ({ roomCode }) => {
        // get current room
        const room = (
          await db.query.rooms.findFirst({
            where: (rooms, { eq }) => eq(rooms.id, roomCode),
            with: {
              users: true
            }
          })
        );
        
        if (!room) {
          console.log('no room');
          return;
        }

        const { users: roomUsers } = room;
        const currentUser = roomUsers.find(({ id }) => id === socket.id);
        if (currentUser) {
          const newState = !currentUser.ready;

          await db
            .update(users)
            .set({ ready: newState })
            .where(eq(users.id, socket.id));
          
          const newUsers = [...roomUsers]
            .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
            .sort((a, b) => a.score - b.score)
            .map(
              ({ id, ready, username, score }) => ({
                id,
                ready: id === socket.id ? newState : ready,
                username,
                score
              })
            );
          
          const gameState: Partial<ClientGameState> = {
            users: newUsers,
          };

          if (newUsers.length === 2 && newUsers[0].ready && newUsers[1].ready) {
            let { bag } = room;
            const racks: ScrabbleCard[][] = [[],[]];

            [racks[0], bag] = generateNewRack(bag);
            [racks[1], bag] = generateNewRack(bag);

            const { gameStarted, turn } = (
              await db
                .update(rooms)
                .set({ gameStarted: true, turn: newUsers[0].id, bag })
                .where(eq(rooms.id, roomCode))
                .returning()
            )[0];

            for (let i = 0; i < 2; i++) {
              io.to(newUsers[i].id).emit('gamestate', {
                rack: racks[i],
              });

              await db
                .update(users)
                .set({ rack: racks[i].map(({ letter }) => letter) })
                .where(eq(users.id, newUsers[i].id)); 
            }

            gameState.gameStarted = gameStarted;
            gameState.turn = turn!;
            gameState.remainingTiles = bag.total;
          }

          io.to(roomCode).emit('gamestate', gameState);
          return;
        }
        
        console.log('user not in room', room);
      });

      socket.on('check:play', async ({ roomCode, play }: PlayArgs) => {
        // check if room exists, if user is in it, and if game has started
        const room = await (
          db
            .query.rooms
            .findFirst({
              where: (rooms, { eq }) => eq(rooms.id, roomCode),
              with: {
                users: true
              }
            })
        );

        if (!room) {
          console.log('no room');
          return;
        }

        const { users: roomUsers, board } = room;
        const firstMove = isEmptyTile(board[7][7]);
        const currentUser = roomUsers.find(({ id }) => id === socket.id);
        if (!currentUser || !room.gameStarted || room.turn !== socket.id) {
          socket.emit('gamestate', {});
          return;
        }

        const positions = play
          .map((play) => {
            const [row, columnLetter] = play.split('.');
            const [column] = columnLetter.split(':');
            const [columnIndex, rowIndex] = [parseInt(column), parseInt(row)];

            return [rowIndex, columnIndex];
          });

        const usedLetters: string[] = [];
        for (let i = 0; i < play.length; i++) {
          const [row, columnLetter] = play[i].split('.');
          const [column, letter] = columnLetter.split(':');
          const [columnIndex, rowIndex] = [parseInt(column), parseInt(row)];

          if (!isEmptyTile(board[rowIndex][columnIndex])) {
            socket.emit('gamestate', {});
            return;
          }

          board[rowIndex][columnIndex] = letter;
          usedLetters.push(letter);
        }

        if (hasLooseTile(board) || isEmptyTile(board[7][7])) {
          socket.emit('invalid-play', {});
          return;
        }

        const currentUserRack = currentUser.rack;
        for (let i = 0; i < usedLetters.length; i++) {
          const index = currentUserRack.findIndex(letter => letter === usedLetters[i]);
          if (index === -1) {
            socket.emit('gamestate', {});
            return;
          }
        }

        let [words, wordPositions] = findWordsOnBoard(board);
        const res = filterWords(words, wordPositions, positions, firstMove);
       
        if (!res || (firstMove && res[0].length > 1)) {
          socket.emit('invalid-play', {});
          return;
        }

        [words, wordPositions] = res;

        const validWords = [];
        const validWordsPositions = [];

        for (let i = 0; i < words.length; i++) {
          // if '_' (wildcard) character is in word
          // replace it for each possible letter
          if (words[i].includes('_')) {
            let possibleWords: string[] = [];
            generateCombinations(words[i], 0, '', possibleWords);
            possibleWords = [...new Set(possibleWords)];

            const results = await Promise.all(possibleWords.map((w) => dict.spell(w)));
            console.log({ results });
            const wildCardWord = possibleWords.filter((w, i) => results[i])[0];

            if (wildCardWord) {
              validWords.push(wildCardWord);
              validWordsPositions.push(wordPositions[i]);
            }

            continue;
          }
 
          if (dict.spellSync(words[i])) {
            validWords.push(words[i]);
            validWordsPositions.push(wordPositions[i]);
          }
        }

        console.log({ words, validWords });

        if (words.length !== validWords.length) {
          socket.emit('invalid-play', {});
          return;
        }

        // sum of all getScoreOfWord(word)
        const playInfo = validWords
          .map((word, i) => ({ word: wordPositions[i], score: getScoreOfWord(word, wordPositions[i]) }));
        
        socket.emit('valid-play', playInfo);
        return;
      });

      socket.on('play', async ({ roomCode, play }: PlayArgs) => {
        // check if room exists, if user is in it, and if game has started
        const room = await (
          db
            .query.rooms
            .findFirst({
              where: (rooms, { eq }) => eq(rooms.id, roomCode),
              with: {
                users: true
              }
            })
        );

        if (!room) {
          console.log('no room');
          return;
        }

        let { bag } = room;
        const { users: roomUsers, board } = room;

        const firstMove = isEmptyTile(board[7][7]);
        const currentUser = roomUsers.find(({ id }) => id === socket.id);
        if (!currentUser || !room.gameStarted || room.turn !== socket.id) {
          socket.emit('gamestate', {});
          return;
        }

        const positions = play
          .map((play) => {
            const [row, columnLetter] = play.split('.');
            const [column] = columnLetter.split(':');
            const [columnIndex, rowIndex] = [parseInt(column), parseInt(row)];

            return [rowIndex, columnIndex];
          });

        const usedLetters: string[] = [];
        for (let i = 0; i < play.length; i++) {
          const [row, columnLetter] = play[i].split('.');
          const [column, letter] = columnLetter.split(':');
          const [columnIndex, rowIndex] = [parseInt(column), parseInt(row)];

          if (!isEmptyTile(board[rowIndex][columnIndex])) {
            socket.emit('gamestate', {});
            return;
          }

          board[rowIndex][columnIndex] = letter;
          usedLetters.push(letter);
        }

        if (hasLooseTile(board) || isEmptyTile(board[7][7])) {
          socket.emit('invalid-play', {});
          return;
        }

        const currentUserRack = currentUser.rack;
        // check if user has all letters they used
        for (let i = 0; i < usedLetters.length; i++) {
          const index = currentUserRack.findIndex(letter => letter === usedLetters[i]);
          if (index === -1) {
            socket.emit('gamestate', {});
          }
        }

        let [words, wordPositions] = findWordsOnBoard(board);
        const res = filterWords(words, wordPositions, positions, firstMove);
       
        if (!res || (firstMove && res[0].length > 1)) {
          socket.emit('invalid-play', {});
          return;
        }

        [words, wordPositions] = res;
        const validWords = [];
        const validWordsPositions = [];

        for (let i = 0; i < words.length; i++) {
          // if '_' (wildcard) character is in word
          // replace it for each possible letter
          if (words[i].includes('_')) {
            let possibleWords: string[] = [];
            generateCombinations(words[i], 0, '', possibleWords);
            possibleWords = [...new Set(possibleWords)];

            const results = await Promise.all(possibleWords.map((w) => dict.spell(w)));
            console.log({ results });
            const wildCardWords = possibleWords.filter((w, i) => results[i]);

            if (wildCardWords.length > 0) {
              validWords.push(wildCardWords[0]);
              validWordsPositions.push(wordPositions[i]);
            }

            continue;
          }
 
          if (dict.spellSync(words[i])) {
            validWords.push(words[i]);
            validWordsPositions.push(wordPositions[i]);
          }
        }

        console.log({ words, validWords });

        if (words.length !== validWords.length) {
          socket.emit('gamestate', {});
          return;
        }

        // sum of all getScoreOfWord(word)
        const newScore = currentUser.score + validWords
          .map((word, i) => getScoreOfWord(word, wordPositions[i]))
          .reduce((a, b) => a + b, 0);
                
        const { rack: opponentRack, id: opponentId } = roomUsers.find(({ id }) => id !== socket.id)!;

        for (let i = 0; i < usedLetters.length; i++) {
          const index = currentUserRack.findIndex(letter => letter === usedLetters[i]);
          currentUserRack.splice(index, 1);
        }

        await db
          .update(users)
          .set({ rack: currentUserRack, score: newScore })
          .where(eq(users.id, socket.id));

        if (bag.total <= 7 - opponentRack.length) {
          const winner = [...roomUsers].sort((a, b) => b.score - a.score)[0].id;

          const gameState = {
            bag: generateNewBag(),
            turn: null,
            board: generateEmptyBoard(),
            gameStarted: false,
            winner
          };

          const clientState = {
            ...gameState,
            users: roomUsers.map(({ id, username, score }) => ({
              id,
              username,
              score: id === socket.id ? newScore : score,
              ready: false
            })),
            rack: []
          };

          await db
            .update(rooms)
            .set(gameState)
            .where(eq(rooms.id, roomCode));
          
          for (let i = 0; i < roomUsers.length; i++) {
            const user = roomUsers[i];
            await db
              .update(users)
              .set({ rack: [], score: 0, ready: false })
              .where(eq(users.id, user.id));
          }
        
          io.to(roomCode).emit('gamestate', clientState);
          return;
        }

        let letter: string;
        while (opponentRack.length < 7) {
          [letter, bag] = drawLetter(bag);
          opponentRack.push(letter);
        }

        await db
          .update(rooms)
          .set({ bag, turn: opponentId, board })
          .where(eq(rooms.id, roomCode));
        
        await db
          .update(users)
          .set({ rack: opponentRack })
          .where(eq(users.id, opponentId));

        const gameState = {
          board,
          turn: opponentId,
          users: roomUsers.map(({ id, username, score }) => ({
            id,
            username,
            score: id === socket.id ? newScore : score
          })),
          currentPlayScore: 0
        };

        socket.emit('gamestate', {
          ...gameState,
          rack: currentUserRack.map(letter => ({ letter, id: crypto.randomUUID() })),
          remainingTiles: bag.total
        });

        io.to(opponentId).emit('gamestate', {
          ...gameState,
          rack: opponentRack.map(letter => ({ letter, id: crypto.randomUUID() })),
          remainingTiles: bag.total
        });
      });

      socket.on('skip', async ({ roomCode }: { roomCode: string }) => {
        const room = await db.query.rooms.findFirst({ where: eq(rooms.id, roomCode), with: { users: true } });
        const opponent = room?.users.filter(({ id }) => id !== socket.id)[0];

        if (room && room.turn === socket.id && opponent) {
          let { bag } = room;
          const { users: roomUsers } = room;

          let letter: string;
          const opponentRack = opponent.rack;

          if (bag.total <= 7 - opponentRack.length) {
            const winner = [...roomUsers].sort((a, b) => b.score - a.score)[0].id;

            const gameState = {
              bag: generateNewBag(),
              turn: null,
              board: generateEmptyBoard(),
              gameStarted: false,
              winner
            };

            const clientState = {
              ...gameState,
              users: roomUsers.map(({ id, username, score }) => ({
                id,
                username,
                score,
                ready: false
              })),
              rack: []
            };

            await db
              .update(rooms)
              .set(gameState)
              .where(eq(rooms.id, roomCode));
            
            for (let i = 0; i < roomUsers.length; i++) {
              const user = roomUsers[i];
              await db
                .update(users)
                .set({ rack: [], score: 0, ready: false })
                .where(eq(users.id, user.id));
            }
          
            io.to(roomCode).emit('gamestate', clientState);
            return;
          }

          while (opponentRack.length < 7) {
            [letter, bag] = drawLetter(bag);
            opponentRack.push(letter);
          }

          await db
            .update(rooms)
            .set({ turn: opponent.id, bag })
            .where(eq(rooms.id, roomCode));
          
          await db
            .update(users)
            .set({ rack: opponentRack })
            .where(eq(users.id, opponent.id));

          io.to(socket.id).emit('gamestate', {
            turn: opponent.id,
            remainingTiles: bag.total
          });

          io.to(opponent.id).emit('gamestate', {
            turn: opponent.id,
            remainingTiles: bag.total,
            rack: opponentRack.map(letter => ({ letter, id: crypto.randomUUID() }))
          });
        }
      });
    });

    res.socket.server.io = io;
  }

  res.end();
};

export default ioHandler;