import AnalyticsHeader from "../components/AnalyticsHeader";

const Graphs = () => {
  return (
    <div className="h-full flex flex-col">
      <div className="fixed top-[61px] inset-x-0 bg-neutral-900 z-10">
        <AnalyticsHeader />
      </div>
      <div className="flex-1 bg-black pt-10">
        <div className="fixed inset-x-0 top-24 bottom-0 bg-black text-white flex overflow-hidden">
          {/* Graph content will go here */}
          <div className="w-full p-4">
            <h2 className="text-2xl font-bold">analytics graphs will go here</h2>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Graphs;
