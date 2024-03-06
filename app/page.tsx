'use client';

import LetterBar from "@/components/letter-bar";
import Tile from "@/components/tile";
import { ClientGameState, RoomJoinedEvent, ScrabbleCard } from "@/types";
import { Icon } from "@iconify/react";
import { Button } from "@nextui-org/button";
import { Card, CardBody } from "@nextui-org/card";
import { Chip } from "@nextui-org/chip";
import { Divider } from "@nextui-org/divider";
import { Input } from "@nextui-org/input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Socket, io } from "socket.io-client";
import { BonusTiles, generateEmptyBoard, generateEmptyPlayBoard, isEmptyTile } from "../utils";
import { useDisclosure, Modal, ModalContent, ModalFooter, ModalBody, ModalHeader } from "@nextui-org/modal";
import useWindowSize from 'react-use/lib/useWindowSize';
import dynamic from "next/dynamic";
import useSound from 'use-sound';
import { Reorder } from "framer-motion";

const emtpyGameState: ClientGameState = {
    board: generateEmptyBoard(),
    gameStarted: false,
    users: [],
    rack: [],
    currentPlayScore: 0,
    remainingTiles: 120
};

function getUsername(id: string, users: { id: string; username: string }[]) {
    return users.find((user) => user.id === id)?.username;
}

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
    const [username, setUsername] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [createRoomLoading, setCreateRoomLoading] = useState(false);
    const [joinRoomLoading, setJoinRoomLoading] = useState(false);
	const [socket, setSocket] = useState<Socket | null>(null);
    const [gameState, setGameState] = useState<ClientGameState>(emtpyGameState);
    const [socketId, setSocketId] = useState<string | null>(null);
    const [canPlay, setCanPlay] = useState<boolean>(false);
    const [evaluatingPlay, setEvaluatingPlay] = useState(false);
    const placedCards = useMemo(() => {
        return getPlacedLetters(playBoard);
    }, [playBoard]);
    const [highlightedPositions, setHighlightedPositions] = useState<number[][]>([]);
    const highlightedPositionStrings = useMemo(() => {
        return highlightedPositions.map(([rowIndex, colIndex]) => `${rowIndex}.${colIndex}`);
    }, [highlightedPositions]);
    const usersSortedByScore = useMemo(() => {
        return gameState.users?.toSorted((a, b) => b.score - a.score)
    }, [gameState.users])
    const { isOpen, onOpen, onClose } = useDisclosure();
    const { width, height } = useWindowSize();
    const [playNewUser] = useSound('/sounds/new-user.mp3');
    const [playPieceTake] = useSound('/sounds/piece-take.mp3', {
        volume: 0.5
    });
    const [playPiecePlace] = useSound('/sounds/piece-place.mp3');
    const [playGameOver] = useSound('/sounds/gameover.mp3');
    const [playSendPlay] = useSound('/sounds/play.mp3');
    const [playYourTurn] = useSound('/sounds/your-turn.mp3');

	const onCreateRoom = useCallback(() => {
		setCreateRoomLoading(true);
		socket?.emit('create-room', { username });
	}, [socket, username]);

    const onJoinRoom = useCallback(() => {
        setJoinRoomLoading(true);
        socket?.emit('join-room', { username, id: roomCode });
    }, [roomCode, socket, username]);

    const onToggleReady = useCallback(() => {
        socket?.emit('toggle-ready', { roomCode: gameState.roomCode });
    }, [gameState.roomCode, socket]);

    const onSendPlay = useCallback(() => {
        playSendPlay();

        if (placedCards.length === 0) {
            socket?.emit('skip', { roomCode: gameState.roomCode });
            return;
        }

        socket?.emit('play', {
            roomCode: gameState.roomCode,
            play: playBoardToPlay(playBoard)
        });
        setEvaluatingPlay(true);
    }, [gameState.roomCode, placedCards.length, playBoard, playSendPlay, socket]);

    const centerIsEmpty = useMemo(() => {
        return (
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
        )
    }, [playBoard, gameState.board]);

    useEffect(() => {
        socket?.emit('check:play', {
            roomCode: gameState.roomCode,
            play: playBoardToPlay(playBoard)
        });
    }, [gameState.roomCode, playBoard, socket]);

    useEffect(() => {
		const socket = io(window.location.protocol + '//' + window.location.host, {
			path: "/api/game",
			port: 3000,
            closeOnBeforeunload: true
		}); 

		socket.on('gamestate', (state: Partial<RoomJoinedEvent>) => {
			setCreateRoomLoading(false);
			setJoinRoomLoading(false);
			setInGame(true);
            setEvaluatingPlay(false);
            setPlayBoard(generateEmptyPlayBoard());
            setHighlightedPositions([]);

            if (state.winner) {
                onOpen();
                playGameOver();
            }

            if (state.newUser) {
                playNewUser();
            }

            if (state.turn === socket.id) {
                playYourTurn();
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
            setRoomCode('');
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
	}, [onOpen, playGameOver, playNewUser, playYourTurn]);

    return (
		<div className="h-full flex gap-4">
            {isOpen && (
                <Confetti
                    width={width}
                    height={height}
                    style={{ zIndex: 99999999 }}
                  />
            )}
            <Modal
                isOpen={isOpen}
                onClose={() => {
                    setGameState(state => ({
                        ...state,
                        winner: undefined
                    }))
                }}
            >
                <ModalContent>
                <ModalHeader className="flex flex-col gap-1 w-full text-center">{getUsername(gameState.winner!, gameState.users)} ganhou!!</ModalHeader>
                <ModalBody className="flex flex-col gap-2 items-center justify-center">
                    {usersSortedByScore.map((user, i) => (
                        <Chip
                            color={gameState.winner === user.id ? 'success' : 'default'}
                            variant="bordered"
                            startContent={
                                gameState.winner === user.id ?
                                <Icon icon="mdi:crown" /> : undefined
                            }
                            className="transition-all px-2"
                            key={user.id}
                            size="lg"
                        >
                            {i+1}. {user.username} ({user.score})
                        </Chip>
                    ))}
                </ModalBody>
                <ModalFooter>
                    <Button color="primary" onPress={onClose}>
                        Ok
                    </Button>
                </ModalFooter>
                </ModalContent>
            </Modal>
            <Modal
                isOpen={!inGame}
                onClose={() => {
                    setGameState(state => ({
                        ...state,
                        winner: undefined
                    }))
                }}
                hideCloseButton
                size="sm"
            >
                <ModalContent>
                    <ModalHeader className="w-full">
                        <h1 className="font-bold text-center text-3xl w-full">Scrabr</h1>
                    </ModalHeader>
                    <ModalBody className="p-5 pt-0">
                        <Divider />
                        <div className="space-y-1">
                            <h4 className="text-medium font-medium">Escolha seu nome de usuário</h4>
                            <p className="text-small text-default-400">E crie um jogo ou entre em uma sala existente.</p>
                        </div>
                        <Divider />
                        <Input
                            value={username}
                            onValueChange={setUsername}
                            label="Nome de usuário"
                            type="text"
                            size="sm"
                        />
                        <Divider />
                        <div className="flex flex-col gap-3">
                            <Input
                                value={roomCode}
                                onValueChange={setRoomCode}
                                label="Código do jogo"
                                type="text"
                                size="sm"
                            />
                            <Button
                                isLoading={joinRoomLoading}
                                color="secondary"
                                isDisabled={!(username.length && roomCode.length)}
                                onPress={() => {
                                    onJoinRoom();
                                }}
                            >
                                Entrar
                            </Button>
                        </div>
                        <Divider />
                        <Button
                            isLoading={createRoomLoading}
                            color="primary"
                            isDisabled={!username.length}
                            onPress={() => {
                                onCreateRoom();
                            }}
                        >
                            Criar um jogo
                        </Button>
                    </ModalBody>
                </ModalContent>
            </Modal>
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
                                                variant={socketId === user.id ? 'shadow' : 'solid'}
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
                                                    <Icon icon="mdi:check-bold" /> : undefined
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
                                    <h2 className="font-semibold text-center mb-3">{gameState.remainingTiles} Pedras</h2>
                                    <Divider className="mb-3" />
                                    {gameState.turn === socketId && (
                                        <>
                                            <h2 className="font-semibold text-center mb-3">
                                                {gameState.currentPlayScore === -1 ? (
                                                    "Inválido"
                                                ) : (
                                                    `+${gameState.currentPlayScore}pts`
                                                )}
                                            </h2>
                                            <Divider className="mb-3" />
                                        </>
                                    )}
                                    <Button
                                        className="min-w-0 w-full box-border flex gap-1 px-1"
                                        endContent={
                                            (gameState.turn === socketId && !evaluatingPlay) ?
                                            <Icon icon="mdi:play" />: undefined
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
                                        <Icon icon={
                                            gameState.users.find(({id}) => id === socketId)?.ready ? 
                                            "mdi:check-bold": "mdi:times"
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
                                        onDrop={() => {
                                            if (movingCard) {
                                                playPiecePlace();

                                                const newBoard = [...playBoard];
                                                newBoard[rowIndex][colIndex] = movingCard;
                                                setPlayBoard(newBoard);
                                                setMovingCard(null);
                                            }
                                        }}
                                        center={rowIndex === 7 && colIndex === 7}
                                        highlighted={highlightedPositionStrings.includes(
                                            `${rowIndex}.${colIndex}`
                                        )}
                                    />
                                    {!isEmptyTile(gameState.board[rowIndex][colIndex]) && (
                                        <Tile
                                            type="placed"
                                            tile={gameState.board[rowIndex][colIndex]}
                                            bonus={BonusTiles[rowIndex][colIndex]}
                                        />
                                    )}
                                    {!isEmptyTile(playBoard[rowIndex][colIndex].letter) && (
                                        <Tile
                                            type="placing"
                                            tile={playBoard[rowIndex][colIndex].letter}
                                            onGrab={() => {
                                                playPieceTake();
                                                setMovingCard(playBoard[rowIndex][colIndex]);
                                                const newBoard = [...playBoard];
                                                newBoard[rowIndex][colIndex] = { letter: ' ', id: '' };
                                                setPlayBoard(newBoard);
                                            }}
                                            bonus={BonusTiles[rowIndex][colIndex]}
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
                onCardSelect={(letter) => {
                    if (letter !== null) {
                        playPieceTake();
                    }
                    setMovingCard(letter);
                }}
                movingCard={movingCard}
                placedCards={placedCards}
            />
        </div>
    )
}