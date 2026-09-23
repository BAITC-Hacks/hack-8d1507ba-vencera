export const money = (value: number) => `${new Intl.NumberFormat('ru-RU').format(value)} ₸`;

export const dateLabel = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

export const hoursLabel = (value: number) => {
  const lastTwo = value % 100;
  const last = value % 10;
  const word = lastTwo >= 11 && lastTwo <= 14 ? 'часов' : last === 1 ? 'час' : last >= 2 && last <= 4 ? 'часа' : 'часов';
  return `${value} ${word}`;
};
