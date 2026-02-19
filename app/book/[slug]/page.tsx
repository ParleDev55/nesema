export default function BookingPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-nesema-bg p-8">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-2">Book a Session</h1>
      <p className="text-nesema-t3">Booking page for practitioner: {params.slug}</p>
    </div>
  );
}
