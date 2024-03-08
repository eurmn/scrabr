'use client';

import CreateRoomModal from '@/components/create-room-modal';
import LetterBar from '@/components/letter-bar';
import Tile from '@/components/tile';
import WinnerModal from '@/components/winner-modal';
import WordsModal from '@/components/words-modal';
import { ClientGameState, ScrabbleCard } from '@/types';
import { Icon } from '@iconify/react';
import { Button } from '@nextui-org/button';
import { Card, CardBody } from '@nextui-org/card';
import { Chip } from '@nextui-org/chip';
import { Divider } from '@nextui-org/divider';
import { useDisclosure } from '@nextui-org/modal';
import { AnimatePresence, Reorder } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useWindowSize from 'react-use/lib/useWindowSize';
import { Socket, io } from 'socket.io-client';
import useSound from 'use-sound';
import { BonusTiles, generateEmptyBoard, generateEmptyPlayBoard, getUsername, isEmptyTile } from '../utils';

const emtpyGameState: ClientGameState = {
  board: generateEmptyBoard(),
  gameStarted: false,
  users: [],
  rack: [],
  currentPlayScore: 0,
  remainingTiles: 0,
  wordsCreated: [],
};

function getPlacedLetters(board: ScrabbleCard[][]): string[] {
  return board
    .flat()
    .filter((tile) => !!tile.id && !isEmptyTile(tile.letter))
    .map(({ id }) => id!);
}

function playBoardToPlay(playBoard: ScrabbleCard[][]): string[] {
  const plays = [];

  for (let rowIndex = 0; rowIndex < 15; rowIndex++) {
    for (let colIndex = 0; colIndex < 15; colIndex++) {
      const tile = playBoard[rowIndex][colIndex];
      if (!isEmptyTile(tile.letter)) {
        plays.push(`${rowIndex}.${colIndex}:${tile.letter}`);
      }
    }
  }

  return plays;
}

type PlayInfoEvent = {
    word: number[][];
    score: number;
}[];

const Confetti = dynamic(() => import('react-confetti'), {
  ssr: false,
});

export default function Home() {
  const [inGame, setInGame] = useState(false);
  const [movingCard, setMovingCard] = useState<ScrabbleCard | null>(null);
  const [playBoard, setPlayBoard] = useState(generateEmptyPlayBoard());
  const [joinRoomLoading, setJoinRoomLoading] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<ClientGameState>(emtpyGameState);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [canPlay, setCanPlay] = useState<boolean>(false);
  const [evaluatingPlay, setEvaluatingPlay] = useState(false);
  const placedCards = getPlacedLetters(playBoard);
  const [highlightedPositions, setHighlightedPositions] = useState<number[][]>([]);
  const highlightedPositionStrings = highlightedPositions.map(([rowIndex, colIndex]) => `${rowIndex}.${colIndex}`);
  const usersSortedByScore = useMemo(() => {
    console.log('calculating sorted by score...');
    return [...gameState.users].sort((a, b) => b.score - a.score);
  }, [gameState.users]);
  const { isOpen: isWinnerOpen, onOpen: onWinnerOpen, onClose: onWinnerClose } = useDisclosure();
  const { isOpen: isWordsOpen, onOpen: onWordsOpen, onClose: onWordsClose } = useDisclosure();
  const { width, height } = useWindowSize();
  const [playNewUser] = useSound('/sounds/new-user.mp3');
  const [playPieceTake] = useSound('/sounds/piece-take.mp3', {
    volume: 0.5
  });
  const [playPiecePlace] = useSound('/sounds/piece-place.mp3');
  const [playGameOver] = useSound('/sounds/gameover.mp3');
  const [playYourTurn] = useSound('/sounds/your-turn.mp3');
  const [playNewTurn] = useSound('/sounds/new-turn.mp3');
  const [playReady] = useSound('/sounds/ready.mp3', {
    volume: 0.25
  });

  const sendCheckPlay = useCallback((playBoard: ScrabbleCard[][]) => {
    socket?.emit('check:play', {
      roomCode: gameState.roomCode,
      play: playBoardToPlay(playBoard)
    });
  }, [gameState.roomCode, socket]);

  const onCardSelect = useCallback((letter: ScrabbleCard | null) => {
    if (letter !== null) {
      playPieceTake();
    }
    setMovingCard(letter);
  }, [playPieceTake]);

  const onGrabPlacing = useCallback((rowIndex: number, colIndex: number) => {
    playPieceTake();
    setMovingCard(playBoard[rowIndex][colIndex]);
    setPlayBoard(board => {
      board[rowIndex][colIndex] = { letter: ' ', id: '' };
      sendCheckPlay(board);
      return [...board];
    });
  }, [playBoard, playPieceTake, sendCheckPlay]);

  const onDropBase = useCallback((rowIndex: number, colIndex: number) => {
    setMovingCard(movingCard => {
      if (movingCard) {
        playPiecePlace();
        setPlayBoard(board => {
          board[rowIndex][colIndex] = movingCard;
          sendCheckPlay(board);
          return board;
        });

        return null;
      }

      return movingCard;
    });
  }, [playPiecePlace, sendCheckPlay]);

  const onCreateRoom = ({ username, blitz }: { username: string, blitz: boolean }) => {
    socket?.emit('create-room', { username, blitz });
  };

  const onJoinRoom = (roomCode: string, username: string) => {
    socket?.emit('join-room', { username, id: roomCode });
  };

  const onToggleReady = () => {
    socket?.emit('toggle-ready', { roomCode: gameState.roomCode });
  };

  const onSendPlay = useCallback(() => {
    if (placedCards.length === 0) {
      socket?.emit('skip', { roomCode: gameState.roomCode });
      return;
    }

    socket?.emit('play', {
      roomCode: gameState.roomCode,
      play: playBoardToPlay(playBoard)
    });
    setEvaluatingPlay(true);
  }, [gameState.roomCode, placedCards.length, playBoard, socket]);

  const centerIsEmpty = useMemo(() => (
    playBoard
      .flat()
      .filter((tile) => !isEmptyTile(tile.letter))
      .length === 0
  ) && (
    gameState
      .board
      .flat()
      .filter((tile) => !isEmptyTile(tile))
      .length === 0
  ), [gameState.board, playBoard]);

  useEffect(() => {
    const socket = io(window.location.protocol + '//' + window.location.host, {
      path: '/api/game',
      port: 3000,
      closeOnBeforeunload: true
    });

    socket.on('gamestate', (state: Partial<ClientGameState>) => {
      console.log('gamestate');

      setInGame(true);
      setEvaluatingPlay(false);
      setPlayBoard(generateEmptyPlayBoard());
      setHighlightedPositions([]);

      if (state.winner) {
        onWinnerOpen();
        playGameOver();
      }

      if (state.newUser) {
        playNewUser();
      }

      if (state.turn === socket.id) {
        playYourTurn();
      } else if (state.turn) {
        playNewTurn();
      }

      if (state.newReady) {
        playReady();
      }

      setGameState((oldState) => ({
        ...oldState,
        ...state
      }));
    });

    socket.on('invalid-play', () => {
      setCanPlay(false);
      setEvaluatingPlay(false);

      setHighlightedPositions([]);

      setGameState((oldState) => ({
        ...oldState,
        currentPlayScore: -1
      }));
    });

    socket.on('valid-play', (playInfo: PlayInfoEvent) => {
      setCanPlay(true);
      setEvaluatingPlay(false);

      const totalScore = playInfo
        .map((info) => info.score)
        .reduce((a, b) => a + b, 0);
            
      setHighlightedPositions(playInfo.map((info) => info.word).flat());
            
      setGameState((oldState) => ({
        ...oldState,
        currentPlayScore: totalScore
      }));
    });

    socket.on('connect', () => {
      setSocketId(socket.id!);
    });

    socket.on('disconnect', () => {
      setSocketId(null);
      setInGame(false);
      setGameState(emtpyGameState);
    });

    socket.on('error', (msg) => {
      switch (msg) {
      case 'join-room':
        setJoinRoomLoading(false);
        break;
      }
    });

    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, [onWinnerOpen, playGameOver, playNewTurn, playNewUser, playReady, playYourTurn]);

  return (
    <div className="h-full flex gap-4">
      {isWinnerOpen && (
        <Confetti
          width={width}
          height={height}
          style={{ zIndex: 99999999 }}
        />
      )}
      <WinnerModal isOpen={isWinnerOpen} onClose={onWinnerClose} users={gameState.users} winner={gameState.winner} />
      <WordsModal isOpen={isWordsOpen} onClose={onWordsClose} wordsCreated={gameState.wordsCreated} />
      <CreateRoomModal
        open={!inGame}
        onJoinRoom={onJoinRoom}
        onCreateRoom={onCreateRoom}
        joinRoomLoading={joinRoomLoading}
        onClose={setJoinRoomLoading}
      />
      <Card>
        <CardBody className={`min-w-[10rem] max-w-[15rem] transition-all overflow-x-hidden bg-content1 ${inGame ? 'brightness-100': 'brightness-50'}`}>
          {inGame && (
            <>
              <h1 className="font-semibold text-center mt-2 mb-3">{gameState.roomCode}</h1>
              <Divider className="mb-4" />
              <Reorder.Group
                axis="y"
                values={usersSortedByScore}
                onReorder={() => {}}
                className="flex-1 flex flex-col gap-2 items-center overflow-hidden"
              >
                {usersSortedByScore.map((user) =>
                  <Reorder.Item dragListener={false} value={user} key={user.id}>
                    {gameState.gameStarted ? 
                      (
                        <Chip
                          onClick={() => setEvaluatingPlay(false)}
                          color={user.id === gameState.turn ? 'primary' : 'default'}
                          variant={user.id === gameState.turn ? 'shadow' : 'solid'}
                          classNames={{
                            base: 'transition-all px-2',
                            content: socketId === user.id ? 'font-bold': undefined
                          }}
                          key={user.id}
                        >
                          {user.username} ({user.score})
                        </Chip>
                      ): (
                        <Chip
                          color={user.ready ? 'success' : 'warning'}
                          variant={user.ready ? 'bordered' : 'dot'}
                          key={user.id}
                          classNames={{
                            base: 'transition-all px-2',
                            content: socketId === user.id ? 'font-bold': undefined
                          }}
                          startContent={
                            user.ready ?
                              <Icon icon="solar:unread-linear" /> : undefined
                          }
                        >
                          {user.username}
                        </Chip>
                      )}
                  </Reorder.Item>
                )}
              </Reorder.Group>
              <Divider className="mb-3" />
              {gameState.gameStarted ? (
                <>
                  <h2 className="font-semibold text-center mb-3">{gameState.remainingTiles} Peças</h2>
                  <Divider className="mb-3" />
                  {gameState.turn === socketId && (
                    <>
                      <h2 className="font-semibold text-center mb-3">
                        {gameState.currentPlayScore === -1 ? (
                          'Inválido'
                        ) : (
                          `+${gameState.currentPlayScore}pts`
                        )}
                      </h2>
                      <Divider className="mb-3" />
                    </>
                  )}
                  <Button className="mb-3 min-w-0 w-full box-border flex gap-1 px-1" color="secondary" onClick={() => onWordsOpen()}>
                    Ver Palavras
                  </Button>
                  <Divider className="mb-3" />
                  <Button
                    className="min-w-0 w-full box-border flex gap-1 px-1"
                    endContent={
                      (gameState.turn === socketId && !evaluatingPlay) ?
                        <Icon icon="solar:play-bold" />: undefined
                    }
                    color={
                      gameState.turn === socketId ?
                        'primary' : 'default'
                    }
                    onPress={() => onSendPlay()}
                    isDisabled={
                      !canPlay
                      || gameState.turn !== socketId
                      || centerIsEmpty
                    }
                    isLoading={evaluatingPlay}
                  >
                    {
                      gameState.turn === socketId
                        ? `${placedCards.length ? 'Jogar': 'Passar'}`
                        : `vez de ${getUsername(gameState.turn!, gameState.users)}`
                    }
                  </Button>
                </>
              ): (
                <Button
                  className="min-w-0 w-full box-border flex gap-1 px-1"
                  startContent={
                    <Icon
                      fontSize="1.25em"
                      icon={
                        gameState.users.find(({id}) => id === socketId)?.ready ? 
                          'solar:check-circle-bold': 'solar:unread-outline'
                      } />
                  }
                  color={
                    gameState.users.find(({id}) => id === socketId)?.ready ?
                      'primary' : 'default'
                  }
                  onPress={() => onToggleReady()}
                >
                                    Pronto
                </Button>
              )}
            </>
          )}
        </CardBody>
      </Card>
      <Card className={`flex-1 ${inGame ? 'brightness-100': 'brightness-50'}`}>
        <CardBody className="h-full w-full">
          <div className="
                        h-full aspect-square mx-auto w-auto grid cursor-default relative
                        grid-cols-15 grid-rows-15 overflow-hidden bg-default select-none
                        outline-2 outline outline-default gap-[2px]
                    ">
            {BonusTiles.map((row, rowIndex) => 
              row.map((tile, colIndex) => (
                <div className="relative" key={`${rowIndex}-${colIndex}`}>
                  <Tile
                    type="base"
                    tile={tile}
                    onDrop={onDropBase}
                    rowIndex={rowIndex}
                    colIndex={colIndex}
                    highlighted={highlightedPositionStrings.includes(
                      `${rowIndex}.${colIndex}`
                    )}
                  />
                  <AnimatePresence>
                    {!isEmptyTile(gameState.board[rowIndex][colIndex]) && (
                      <Tile
                        type="placed"
                        tile={gameState.board[rowIndex][colIndex]}
                        bonus={BonusTiles[rowIndex][colIndex]}
                        rowIndex={rowIndex}
                        colIndex={colIndex}
                      />
                    )}
                  </AnimatePresence>
                  {!isEmptyTile(playBoard[rowIndex][colIndex].letter) && (
                    <Tile
                      type="placing"
                      tile={playBoard[rowIndex][colIndex].letter}
                      onGrab={() => onGrabPlacing(rowIndex, colIndex)}
                      bonus={BonusTiles[rowIndex][colIndex]}
                      rowIndex={rowIndex}
                      colIndex={colIndex}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>
      <LetterBar
        active={gameState.turn === socketId}
        inGame={inGame && gameState.gameStarted}
        letters={gameState.rack}
        onCardSelect={onCardSelect}
        movingCard={movingCard}
        placedCards={placedCards}
      />
    </div>
  );
}