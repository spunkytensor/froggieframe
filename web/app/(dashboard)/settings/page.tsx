'use client';

import * as React from 'react';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Key, Shield, ShieldCheck, ShieldOff, User } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';
import { changePasswordSchema } from '@/lib/validators';

export default function SettingsPage() {
  const { user } = useAuth();
  const [otpEnabled, setOtpEnabled] = React.useState(false);
  const [otpSetupData, setOtpSetupData] = React.useState<{
    secret: string;
    qrCode: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [passwordLoading, setPasswordLoading] = React.useState(false);
  const [showDisable2FAPrompt, setShowDisable2FAPrompt] = React.useState(false);
  const [disableCode, setDisableCode] = React.useState('');

  React.useEffect(() => {
    const checkOtpStatus = async () => {
      if (!user) return;

      const supabase = createClient();
      const { data } = await supabase
        .from('otp_secrets')
        .select('is_enabled')
        .eq('user_id', user.id)
        .maybeSingle<{ is_enabled: boolean }>();

      setOtpEnabled(data?.is_enabled ?? false);
      setLoading(false);
    };

    checkOtpStatus();
  }, [user]);

  const handleSetup2FA = async () => {
    setError('');
    setSuccess('');

    const response = await fetch('/api/auth/setup-otp', {
      method: 'POST',
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to set up 2FA');
      return;
    }

    const data = await response.json();
    setOtpSetupData(data);
  };

  const handleVerify2FA = async () => {
    setError('');

    const response = await fetch('/api/auth/setup-otp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: verifyCode }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Invalid code');
      return;
    }

    setOtpEnabled(true);
    setOtpSetupData(null);
    setVerifyCode('');
    setSuccess('Two-factor authentication enabled successfully!');
  };

  const handleDisable2FA = async () => {
    if (!disableCode || disableCode.length !== 6) {
      setError('Please enter your 6-digit authenticator code');
      return;
    }

    setError('');

    const response = await fetch('/api/auth/setup-otp', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: disableCode }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to disable 2FA');
      return;
    }

    setOtpEnabled(false);
    setShowDisable2FAPrompt(false);
    setDisableCode('');
    setSuccess('Two-factor authentication disabled.');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setPasswordLoading(true);

    try {
      const validation = changePasswordSchema.safeParse({
        currentPassword,
        newPassword,
        confirmNewPassword,
      });

      if (!validation.success) {
        setError(validation.error.errors[0].message);
        setPasswordLoading(false);
        return;
      }

      const supabase = createClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        setError('Current password is incorrect');
        setPasswordLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        setPasswordLoading(false);
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSuccess('Password changed successfully!');
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and security
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Account Info */}
      <CollapsibleCard
        title="Account"
        description="Your account information"
        icon={<User className="h-5 w-5" />}
      >
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email || ''} disabled />
        </div>
      </CollapsibleCard>

      {/* Change Password */}
      <CollapsibleCard
        title="Change Password"
        description="Update your password to keep your account secure"
        icon={<Key className="h-5 w-5" />}
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm New Password</Label>
            <PasswordInput
              id="confirm-new-password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" isLoading={passwordLoading}>
            Change Password
          </Button>
        </form>
      </CollapsibleCard>

      {/* Two-Factor Authentication */}
      <CollapsibleCard
        title="Two-Factor Authentication"
        description="Add an extra layer of security to your account"
        icon={<Shield className="h-5 w-5" />}
      >
        <div className="space-y-4">
          {otpEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <ShieldCheck className="h-5 w-5" />
                <span>Two-factor authentication is enabled</span>
              </div>
              {showDisable2FAPrompt ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Enter your authenticator code to confirm:
                  </p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                    className="font-mono text-center text-lg tracking-widest w-32"
                  />
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={handleDisable2FA}>
                      Confirm Disable
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDisable2FAPrompt(false);
                        setDisableCode('');
                        setError('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="destructive" onClick={() => setShowDisable2FAPrompt(true)}>
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Disable 2FA
                </Button>
              )}
            </div>
          ) : otpSetupData ? (
            <div className="space-y-4">
              <p className="text-sm">
                Scan this QR code with your authenticator app (Google Authenticator,
                Authy, etc.)
              </p>
              <div className="flex justify-center">
                <img
                  src={otpSetupData.qrCode}
                  alt="QR Code"
                  className="border rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Or enter this secret manually:</Label>
                <code className="block p-2 bg-muted rounded text-sm break-all">
                  {otpSetupData.secret}
                </code>
              </div>
              <div className="space-y-2">
                <Label htmlFor="verify-code">
                  Enter the 6-digit code from your app to verify
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="verify-code"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    maxLength={6}
                    placeholder="000000"
                    className="max-w-[200px]"
                  />
                  <Button onClick={handleVerify2FA} disabled={verifyCode.length !== 6}>
                    Verify & Enable
                  </Button>
                </div>
              </div>
              <Button variant="outline" onClick={() => setOtpSetupData(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Two-factor authentication adds an extra layer of security by
                requiring a code from your phone in addition to your password.
              </p>
              <Button onClick={handleSetup2FA}>
                <Shield className="h-4 w-4 mr-2" />
                Set Up 2FA
              </Button>
            </div>
          )}
        </div>
      </CollapsibleCard>
    </div>
  );
}
