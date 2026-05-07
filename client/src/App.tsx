import AppPresentation from "./app/AppPresentation";
import { useAppControllerModel } from "./app/useAppControllerModel";

function App() {
  return <AppPresentation model={useAppControllerModel()} />;
}

export default App;
