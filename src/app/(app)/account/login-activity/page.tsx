
// src/app/(app)/account/login-activity/page.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getLoginHistory, type LoginActivity, deleteLoginActivityEntry } from '@/lib/user-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ShieldAlert, Server, Network, CalendarClock, Trash2, AlertTriangle } from "lucide-react";
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

export default function LoginActivityPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loginActivities, setLoginActivities] = useState<LoginActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (user?.username) {
      setIsLoading(true);
      setError(null);
      try {
        const activities = await getLoginHistory(user.username);
        setLoginActivities(activities);
      } catch (err) {
        setError("Failed to load login activity. Please try again later.");
        console.error("Error fetching login activity:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
      // setError("User not logged in."); // Or redirect
    }
  }, [user?.username]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleDeleteActivity = async () => {
    if (!selectedActivityId) return;
    setIsDeleting(true);
    const result = await deleteLoginActivityEntry(selectedActivityId);
    if (result.success) {
      toast({ title: "Activity Deleted", description: "The login activity record has been removed." });
      fetchActivities(); // Refresh the list
    } else {
      toast({ title: "Deletion Failed", description: result.message || "Could not delete the activity record.", variant: "destructive" });
    }
    setIsDeleting(false);
    setIsConfirmingDelete(false);
    setSelectedActivityId(null);
  };
  
  return (
    <>
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="h-8 w-8 text-primary" />
            <CardTitle className="text-xl sm:text-2xl font-headline">Login Activity</CardTitle>
          </div>
          <CardDescription>
            Review recent login activity for your account. The &apos;Device / Browser&apos; (User Agent) and &apos;IP Address&apos;
            columns help you identify the devices and approximate locations from which your account was accessed.
            If you see any suspicious activity, please change your password immediately. Deleting an entry here only removes the record from this list.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading activity...</p>
            </div>
          ) : error ? (
            <p className="text-destructive text-center">{error}</p>
          ) : loginActivities.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No login activity found for your account.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]"><CalendarClock className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Date & Time</TableHead>
                    <TableHead className="min-w-[250px]"><Server className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Device / Browser</TableHead>
                    <TableHead className="min-w-[150px]"><Network className="inline-block mr-1 h-4 w-4 text-muted-foreground" />IP Address</TableHead>
                    <TableHead className="text-right min-w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginActivities.map((activity) => (
                    <TableRow key={activity._id?.toString() || activity.loginTimestamp.toString() + activity.ipAddress}>
                      <TableCell>{new Date(activity.loginTimestamp).toLocaleString()}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title={activity.userAgent || 'N/A'}>
                        {activity.userAgent || 'N/A'}
                      </TableCell>
                      <TableCell>{activity.ipAddress || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedActivityId(activity._id || null); // Ensure _id is used
                            setIsConfirmingDelete(true);
                          }}
                          disabled={!activity._id || isDeleting} // Disable if no _id or currently deleting
                          title="Delete this login record"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete login record</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Button variant="outline" onClick={() => router.back()} className="mt-6 w-full sm:w-auto">
            Back to Account
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this login activity record? This action cannot be undone and only removes the record, it does not log out the session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteActivity}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
