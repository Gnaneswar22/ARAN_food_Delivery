import Orders from './Orders';

export default function Pickup() {
  return <Orders title="Pickup" subtitle="Preparation, ready-for-pickup and collection" fixed={{ orderType: 'pickup' }} />;
}
