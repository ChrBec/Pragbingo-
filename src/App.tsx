import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./state/AuthContext";
import { EventProvider } from "./state/EventContext";
import { Landing } from "./pages/Landing";
import { CreateEvent } from "./pages/CreateEvent";
import { JoinEvent } from "./pages/JoinEvent";
import { Login } from "./pages/Login";
import { MyEvents } from "./pages/MyEvents";
import { Dashboard } from "./pages/Dashboard";
import { MissionsTab } from "./components/tabs/MissionsTab";
import { BingoTab } from "./components/tabs/BingoTab";
import { FeedTab } from "./components/tabs/FeedTab";
import { LeaderboardTab } from "./components/tabs/LeaderboardTab";
import { ChaosTab } from "./components/tabs/ChaosTab";
import { ChallengesTab } from "./components/tabs/ChallengesTab";
import { VotingTab } from "./components/tabs/VotingTab";
import { ReportTab } from "./components/tabs/ReportTab";
import { HangoverTab } from "./components/tabs/HangoverTab";
import { ManageTab } from "./components/tabs/ManageTab";

function App() {
  return (
    <AuthProvider>
      <EventProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/create" element={<CreateEvent />} />
            <Route path="/join" element={<JoinEvent />} />
            <Route path="/join/:code" element={<JoinEvent />} />
            <Route path="/login" element={<Login />} />
            <Route path="/my-events" element={<MyEvents />} />
            <Route path="/app" element={<Dashboard />}>
              <Route index element={<Navigate to="missions" replace />} />
              <Route path="missions" element={<MissionsTab />} />
              <Route path="bingo" element={<BingoTab />} />
              <Route path="feed" element={<FeedTab />} />
              <Route path="leaderboard" element={<LeaderboardTab />} />
              <Route path="chaos" element={<ChaosTab />} />
              <Route path="challenges" element={<ChallengesTab />} />
              <Route path="voting" element={<VotingTab />} />
              <Route path="report" element={<ReportTab />} />
              <Route path="hangover" element={<HangoverTab />} />
              <Route path="manage" element={<ManageTab />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </EventProvider>
    </AuthProvider>
  );
}

export default App;
