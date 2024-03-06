'use client';

import { Card, CardBody } from '@nextui-org/card';
import { useCallback, useEffect, useState } from 'react';
import ScrabbleCard from './scrabble-card';
import { ScrabbleCard as ScrabbleCardType } from '@/types';

type Props = {
    letters: ScrabbleCardType[];
    onCardSelect?: (args: ScrabbleCardType | null) => void;
    movingCard?: ScrabbleCardType | null;
    inGame?: boolean;
    active?: boolean;
    placedCards?: string[];
}

export default function LetterBar({ letters, onCardSelect, movingCard, inGame, active, placedCards }: Props) {
  const [cardSize, setCardSize] = useState<{ height: number, width: number }>({ height: 0, width: 0 });
  const [movingCardPosition, setMovingCardPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  });

  const onMouseMove = (e: MouseEvent) => setMovingCardPosition({ x: e.clientX, y: e.clientY });

  const onMouseUp = useCallback(() => {
    if (movingCard) {
      onCardSelect?.(null);
    }
  }, [movingCard, onCardSelect]);

  return (    
    <div className={`w-[6rem] h-full ${inGame ? undefined: 'brightness-50'}`}>
      {movingCard && (
        <ScrabbleCard
          letter={movingCard.letter}
          dragging
          style={{
            position: 'absolute',
            top: movingCardPosition.y - cardSize.height / 2,
            left: movingCardPosition.x - cardSize.width / 2,
            zIndex: 1000,
          }}
        />
      )}
      <Card className="h-full">
        <CardBody>
          <div className="flex flex-col w-full flex-1 justify-center items-center">
            {inGame ?
              letters.map((letter, index) => (
                <ScrabbleCard
                  key={index}
                  letter={letter.letter}
                  onGrab={({ height, width, x, y }) => {
                    if (active) {
                      onCardSelect?.(letter);
                      setCardSize({ height, width });
                      setMovingCardPosition({ x, y });
                    }
                  }}
                  invisible={
                    (movingCard && movingCard.id === letter.id) ||
                                        (!!letter.id && placedCards?.includes(letter.id))
                  }
                />
              ))
              : (
                letters.map((letter, index) => (
                  <div className="w-[4.5rem] h-[4.5rem] bg-default rounded-lg" key={index}/>
                ))
              )
            }
          </div>
        </CardBody>
      </Card>
    </div>
  );
}