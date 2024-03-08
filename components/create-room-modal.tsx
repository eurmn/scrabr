import { Button } from '@nextui-org/button';
import { Divider } from '@nextui-org/divider';
import { Input } from '@nextui-org/input';
import { Switch } from '@nextui-org/switch';
import { Modal, ModalBody, ModalContent, ModalHeader } from '@nextui-org/modal';
import { memo, useState } from 'react';
import { Icon } from '@iconify/react';

type Props = {
    open: boolean;
    onJoinRoom: (roomCode: string, username: string) => void;
    onCreateRoom: (args: { username: string, blitz: boolean }) => void;
    onClose: (value: boolean) => void;
    joinRoomLoading: boolean;
}

function InternalCreateRoomModal({ open, onJoinRoom, onCreateRoom, onClose, joinRoomLoading }: Props) {
  const [username, setUsername] = useState('');
  const [blitz, setBlitz] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [createRoomLoading, setCreateRoomLoading] = useState(false);

  return (
    <Modal
      isOpen={open}
      onClose={() => {
        setCreateRoomLoading(false);
        onClose(false);
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
                onJoinRoom(roomCode, username);
              }}
            >
                Entrar
            </Button>
          </div>
          <Divider />
          <div className="flex justify-between w-full gap-2">
            <h3 className="text-sm flex gap-2 items-center"><Icon icon="solar:bolt-bold" />Modo Blitz</h3>
            <Switch onValueChange={setBlitz} startContent={<Icon color="white" icon="solar:bolt-bold" />} />
          </div>
          <Button
            isLoading={createRoomLoading}
            color="primary"
            isDisabled={!username.length}
            onPress={() => {
              setCreateRoomLoading(true);
              onCreateRoom({ username, blitz });
            }}
            className="w-full"
          >
            Criar um jogo
          </Button>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

const CreateRoomModal = memo(InternalCreateRoomModal);

export default CreateRoomModal;