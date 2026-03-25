const demoTickets = [
  {
    id: 't_001',
    ticketTypeId: 'type_001',
    slug: 'rick-vip-pass',
    title: 'Rick VIP Pass',
    description: 'VIP access to the interdimensional zone.',
    eventAt: '2108-03-22T19:30:00.000Z',
    price: 1290,
    currency: 'CZK',
    imageUrl: '/assets/characters/1-rick-sanchez.jpg',
    totalQuantity: 25,
    soldQuantity: 5,
    activeHolds: 2,
    isActive: true,
  },
  {
    id: 't_002',
    ticketTypeId: 'type_002',
    slug: 'morty-standard-entry',
    title: 'Morty Standard Entry',
    description: 'Standard admission for a slightly less traumatic experience.',
    eventAt: '2137-11-04T18:00:00.000Z',
    price: 790,
    currency: 'CZK',
    imageUrl: '/assets/characters/2-morty-smith.jpg',
    totalQuantity: 40,
    soldQuantity: 11,
    activeHolds: 3,
    isActive: true,
  },
  {
    id: 't_003',
    ticketTypeId: 'type_003',
    slug: 'birdperson-backstage',
    title: 'Birdperson Backstage',
    description: 'Backstage access with unusually calm energy.',
    eventAt: '2189-06-16T20:15:00.000Z',
    price: 1590,
    currency: 'CZK',
    imageUrl: '/assets/characters/3-birdperson.jpg',
    totalQuantity: 10,
    soldQuantity: 4,
    activeHolds: 1,
    isActive: true,
  },
];

function withAvailability(ticket) {
  return {
    ...ticket,
    availableQuantity:
      ticket.totalQuantity - ticket.soldQuantity - ticket.activeHolds,
  };
}

function getAllTickets() {
  return demoTickets.map(withAvailability);
}

function getTicketById(ticketId) {
  const ticket = demoTickets.find((item) => item.id === ticketId);

  if (!ticket) {
    return null;
  }

  return withAvailability(ticket);
}

function incrementActiveHolds(ticketId) {
  const ticket = demoTickets.find((item) => item.id === ticketId);

  if (!ticket) {
    return null;
  }

  ticket.activeHolds += 1;

  return withAvailability(ticket);
}

function decrementActiveHolds(ticketId) {
  const ticket = demoTickets.find((item) => item.id === ticketId);

  if (!ticket) {
    return null;
  }

  if (ticket.activeHolds > 0) {
    ticket.activeHolds -= 1;
  }

  return withAvailability(ticket);
}

function incrementSoldQuantity(ticketId, quantity = 1) {
  const ticket = demoTickets.find((item) => item.id === ticketId);

  if (!ticket) {
    return null;
  }

  ticket.soldQuantity += quantity;

  return withAvailability(ticket);
}

module.exports = {
  getAllTickets,
  getTicketById,
  incrementActiveHolds,
  decrementActiveHolds,
  incrementSoldQuantity,
};