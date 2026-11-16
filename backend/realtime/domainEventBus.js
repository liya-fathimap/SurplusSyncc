const { EventEmitter } = require('node:events');

const domainEventBus = new EventEmitter();

function publishDomainEvent(eventName, payload) {
  domainEventBus.emit(eventName, payload);
}

module.exports = { domainEventBus, publishDomainEvent };
