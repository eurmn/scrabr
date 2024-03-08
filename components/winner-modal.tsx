import { getUsername } from '@/utils';
import { Icon } from '@iconify/react';
import { Button } from '@nextui-org/button';
import { Chip } from '@nextui-org/chip';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/modal';
import { memo } from 'react';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    users: { id: string; username: string; score: number }[];
    winner: string | undefined;
}

function InternalWinnerModal({ isOpen, onClose, users, winner }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 w-full text-center">{getUsername(winner!, users)} ganhou!!</ModalHeader>
        <ModalBody className="flex flex-col gap-2 items-center justify-center">
          {users.map((user, i) => (
            <Chip
              color={winner === user.id ? 'success' : 'default'}
              variant="bordered"
              startContent={
                winner === user.id ?
                  <Icon icon="solar:crown-line-bold" /> : undefined
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
  );
}

const WinnerModal = memo(InternalWinnerModal);

export default WinnerModal;