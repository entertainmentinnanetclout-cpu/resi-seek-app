import logo from "@/assets/preloader.png";

const Preloader = () => {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[9999]">
      <div className="animate-pulse">
        <img src={logo} alt="ResKonnect" className="h-40 w-auto" />
      </div>
    </div>
  );
};

export default Preloader;
