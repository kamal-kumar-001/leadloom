import {
  Connector,
  ConnectorCapability,
} from './connector.interface';
import { ApolloConnector } from './apollo.connector';
import { HunterConnector } from './hunter.connector';
import { DropcontactConnector } from './dropcontact.connector';
import { PdlConnector } from './pdl.connector';
import { ZeroBounceConnector } from './zerobounce.connector';
import { NeverBounceConnector } from './neverbounce.connector';
import { SerperConnector } from './serper.connector';
import { OpenAiConnector } from './openai.connector';
import { AnthropicConnector } from './anthropic.connector';
import { OllamaConnector } from './ollama.connector';

export class ConnectorRegistry {
  private readonly connectors = new Map<string, Connector<any, any>>();

  constructor(initialConnectors?: Connector<any, any>[]) {
    if (initialConnectors) {
      for (const connector of initialConnectors) {
        this.register(connector);
      }
    }
  }

  register(connector: Connector<any, any>): void {
    this.connectors.set(connector.id, connector);
  }

  get<TInput = unknown, TOutput = unknown>(
    id: string
  ): Connector<TInput, TOutput> | undefined {
    return this.connectors.get(id) as Connector<TInput, TOutput> | undefined;
  }

  has(id: string): boolean {
    return this.connectors.has(id);
  }

  list(): Connector<any, any>[] {
    return Array.from(this.connectors.values());
  }

  findByCapability(capability: ConnectorCapability): Connector<any, any>[] {
    return this.list().filter((c) => c.capabilities.includes(capability));
  }
}

/**
 * Creates and initializes a registry populated with the canonical 10 public connectors.
 */
export function createDefaultConnectorRegistry(): ConnectorRegistry {
  return new ConnectorRegistry([
    new ApolloConnector(),
    new HunterConnector(),
    new DropcontactConnector(),
    new PdlConnector(),
    new ZeroBounceConnector(),
    new NeverBounceConnector(),
    new SerperConnector(),
    new OpenAiConnector(),
    new AnthropicConnector(),
    new OllamaConnector(),
  ]);
}

export const defaultRegistry = createDefaultConnectorRegistry();
