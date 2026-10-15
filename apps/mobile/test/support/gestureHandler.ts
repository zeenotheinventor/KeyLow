// The app root wraps every screen in the gesture handler's root view, whose native module Jest does not have.
// Its own setup file swaps in a mock. A test that renders the root layout imports this first, because a setup
// file for every test is test configuration and belongs to the Housekeeping session.
import "react-native-gesture-handler/jestSetup";
