import { useApi, Loading, ErrorBox } from '@movers/ui';
import { useSpace } from './Dashboard.jsx';
import { BookingWidget } from '../../components/BookingWidget.jsx';

export default function Book() {
  const { data, reload } = useSpace();
  const space = useApi('/public/space');
  return (
    <div className="pg">
      <div className="pg-h"><div><p className="eyebrow">Movers Space{data.isStudent ? ' · student rate' : ''}</p><h1>Book a space</h1><p className="desc">Desks, the meeting room or the entire space. Pay now, or save the booking and pay later.{data.isStudent ? ' Your student discount is applied to desk passes.' : ''}</p></div></div>
      {space.loading ? <Loading /> : space.error ? <ErrorBox error={space.error} /> : <BookingWidget space={space.data} inDashboard onBooked={reload} />}
    </div>
  );
}
