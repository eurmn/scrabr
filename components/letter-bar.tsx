'use client';

import { ScrabbleCard as ScrabbleCardType } from '@/types';
import { Card, CardBody } from '@nextui-org/card';
import { AnimatePresence, Reorder } from 'framer-motion';
import { memo, useCallback, useEffect, useState } from 'react';
import ScrabbleCard from './scrabble-card';

type Props = {
    letters: ScrabbleCardType[];
    onCardSelect?: (args: ScrabbleCardType | null) => void;
    movingCard?: ScrabbleCardType | null;
    inGame?: boolean;
    active?: boolean;
    placedCards?: string[];
}

function InternalLetterBar({ letters, onCardSelect, movingCard, inGame, active, placedCards }: Props) {
  const [cardSize, setCardSize] = useState<{ height: number, width: number }>({ height: 0, width: 0 });
  const [movingCardPosition, setMovingCardPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

  const onMouseMove = (e: MouseEvent) => setMovingCardPosition({ x: e.clientX, y: e.clientY });

  const onMouseUp = useCallback(() => {
    onCardSelect?.(null);
  }, [onCardSelect]);

  useEffect(() => { 
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseUp]);

  const onGrab = useCallback(({ height, width, x, y, letter }: { height: number, width: number, x: number, y: number, letter: ScrabbleCardType }) => {
    if (active) {
      onCardSelect?.(letter);
      setCardSize({ height, width });
      setMovingCardPosition({ x, y });
    }
  }, [active, onCardSelect]);

  return (    
    <div className={`w-[6rem] h-full ${inGame ? undefined: 'brightness-50'}`}>
      <AnimatePresence>
        {movingCard && (
          <ScrabbleCard
            letter={movingCard}
            dragging
            style={{
              position: 'absolute',
              zIndex: 1000
            }}
            x={movingCardPosition.x - cardSize.width / 2}
            y={movingCardPosition.y - cardSize.height / 2}
          />
        )}
      </AnimatePresence>
      <Card className="h-full">
        <CardBody>
          <Reorder.Group
            axis="y"
            values={letters}
            onReorder={() => {}}
            className="flex flex-col w-full flex-1 justify-center items-center"
          >
            {inGame ?
              letters.map((letter) => (
                <Reorder.Item
                  value={letter.letter}
                  key={letter.id}
                  dragListener={false}
                >
                  <ScrabbleCard
                    letter={letter}
                    onGrab={onGrab}
                    invisible={
                      (movingCard && movingCard.id === letter.id) ||
                        (!!letter.id && placedCards?.includes(letter.id))
                    }
                  />
                </Reorder.Item>
              ))
              : (
                letters.map((letter, index) => (
                  <div className="w-[4.5rem] h-[4.5rem] bg-default rounded-lg" key={index}/>
                ))
              )
            }
          </Reorder.Group>
        </CardBody>
      </Card>
    </div>
  );
}

const LetterBar = memo(InternalLetterBar);

export default LetterBar;
