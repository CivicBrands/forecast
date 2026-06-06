import solace from "solclientjs";

export interface SwimOptions {
  url: string;
  vpn: string;
  username: string;
  password: string;
  queue: string;
  onMessage: (xml: string, ack: () => void) => void;
  onUp?: () => void;
  onDown?: (reason: string) => void;
}

let factoryInitialized = false;
function initFactory() {
  if (factoryInitialized) return;
  const props = new solace.SolclientFactoryProperties();
  props.profile = solace.SolclientFactoryProfiles.version10;
  solace.SolclientFactory.init(props);
  factoryInitialized = true;
}

/**
 * Establish a guaranteed-delivery consumer against a Solace queue. Returns a
 * stop function for graceful shutdown. The caller is responsible for handling
 * reconnect; this function emits down events but does not retry by itself.
 */
export function startConsumer(opts: SwimOptions): () => Promise<void> {
  initFactory();

  const session = solace.SolclientFactory.createSession({
    url: opts.url,
    vpnName: opts.vpn,
    userName: opts.username,
    password: opts.password,
    reconnectRetries: -1,
    connectRetries: 10,
    reconnectRetryWaitInMsecs: 5000,
  });

  session.on(solace.SessionEventCode.UP_NOTICE, () => {
    opts.onUp?.();
    const consumer = session.createMessageConsumer({
      queueDescriptor: {
        name: opts.queue,
        type: solace.QueueType.QUEUE,
      },
      acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT,
    });
    consumer.on(solace.MessageConsumerEventName.MESSAGE, (message: solace.Message) => {
      const buf = message.getBinaryAttachment();
      let xml = "";
      if (typeof buf === "string") {
        xml = buf;
      } else if (buf instanceof Uint8Array) {
        xml = new TextDecoder("utf-8").decode(buf);
      }
      if (xml) opts.onMessage(xml, () => message.acknowledge());
      else message.acknowledge();
    });
    consumer.on(solace.MessageConsumerEventName.DOWN_ERROR, (err: unknown) => {
      opts.onDown?.(`consumer down: ${describe(err)}`);
    });
    try {
      consumer.connect();
    } catch (err) {
      opts.onDown?.(`consumer connect failed: ${describe(err)}`);
    }
  });

  session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (err: unknown) => {
    opts.onDown?.(`session connect failed: ${describe(err)}`);
  });
  session.on(solace.SessionEventCode.DISCONNECTED, () => {
    opts.onDown?.("session disconnected");
  });

  try {
    session.connect();
  } catch (err) {
    opts.onDown?.(`session connect threw: ${describe(err)}`);
  }

  return async () => {
    try {
      session.disconnect();
    } catch {
      // ignore
    }
  };
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
