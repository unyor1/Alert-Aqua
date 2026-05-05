import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { supabase } from "../../utils/supabase/client";

interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  approved: boolean;
  role: string;
  created_at: string;
}

interface DeviceState {
  device_id: string;
  water_level: number | null;
  updated_at: string;
}

interface SensorLog {
  id: number;
  device_id: string;
  water_level: number;
  created_at: string;
}

export function Admin() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pending, setPending] = useState<Profile[]>([]);
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [logs, setLogs] = useState<SensorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      navigate("/login");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, username, email, approved, role, created_at")
      .order("created_at", { ascending: false });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const currentProfile = profileData.find((p) => p.id === session.data.session?.user.id);
    if (!currentProfile || currentProfile.role !== "admin") {
      navigate("/dashboard");
      return;
    }

    const pendingList = profileData.filter((p) => !p.approved && p.role !== "admin");

    const { data: deviceData, error: deviceError } = await supabase
      .from("device_state")
      .select("device_id, water_level, updated_at")
      .order("updated_at", { ascending: false });

    if (deviceError) {
      setError(deviceError.message);
      setLoading(false);
      return;
    }

    const { data: logData, error: logError } = await supabase
      .from("sensor_logs")
      .select("id, device_id, water_level, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (logError) {
      setError(logError.message);
      setLoading(false);
      return;
    }

    setProfiles(profileData);
    setPending(pendingList);
    setDevices(deviceData ?? []);
    setLogs(logData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleApprove = async (userId: string) => {
    setError(null);
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ approved: true })
      .eq("id", userId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await loadData();
  };

  const handleReject = async (userId: string) => {
    setError(null);
    // Delete from user_profiles
    const { error: deleteProfileError } = await supabase
      .from("user_profiles")
      .delete()
      .eq("id", userId);
    if (deleteProfileError) {
      setError(deleteProfileError.message);
      return;
    }
    // Delete from auth.users (requires service role, so must be done via Supabase dashboard or an admin function)
    // Here, we just remove from user_profiles for client safety
    await loadData();
  };

  const approvedCount = profiles.filter((p) => p.approved).length;
  const pendingCount = pending.length;
  const totalUsers = profiles.length;

  return (
    <div className="min-h-full bg-gray-50 py-8">
      <div className="container mx-auto px-4 space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Control Center</h1>
          <p className="text-gray-600">Approve users and monitor sensors in real time.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Approved Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Approvals</CardTitle>
            <CardDescription>Approve or reject user registrations.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-gray-500">No pending users.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.username || "(no name)"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" onClick={() => handleApprove(user.id)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(user.id)}>
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Sensor Dashboard and Data History removed as per user request */}
      </div>
    </div>
  );
}
