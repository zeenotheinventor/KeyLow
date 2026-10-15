import { configure } from "@testing-library/react-native";

// Testing Library gives waitFor and findBy* 1 s by default, and the test timeout does not change that.
// A passing test returns as soon as its assertion holds, so a longer limit only helps a loaded machine.
configure({ asyncUtilTimeout: 5000 });
