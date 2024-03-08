import { Button } from '@nextui-org/button';
import { Chip } from '@nextui-org/chip';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/modal';
import { memo } from 'react';

type Props = {
    isOpen: boolean;
    wordsCreated: string[];
    onClose: () => void;
};

function InternalWordsModal({ isOpen, wordsCreated, onClose }: Props) {
  return (
    <Modal isOpen={isOpen} size="md" hideCloseButton>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 w-full text-center">Palavras formadas</ModalHeader>
        <ModalBody className="w-full">
          <div className="flex flex-wrap gap-2 items-center justify-center">
            {
              wordsCreated.length > 0 ?
                wordsCreated.map((word, i) => (
                  <Chip
                    variant="bordered"
                    className="px-2"
                    key={i}
                    size="lg"
                  >
                    {word}
                  </Chip>
                ))
                : 'Nenhuma palavra foi formada por enquanto.'
            }
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onPress={onClose}>
            Fechar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

const WordsModal = memo(InternalWordsModal);

export default WordsModal;
