"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  UserPlus,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  MoreVertical,
  ChevronRight,
  Crown,
  Activity,
  Sparkles,
  Award,
  Clock,
  TrendingUp,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  IndianRupee,
  ArrowUpRight,
  Percent,
  Target,
  LayoutDashboard,
  Settings,
  BarChart3,
  PieChart,
  CreditCard,
  Zap,
  Shield,
  RefreshCw
} from "lucide-react";

import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useModal } from "@/hooks/use-modal";
import { deleteContact } from "@/queries/contacts";
import ContactDetails from "@/components/forms/ContactDetails";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import CreateContactButton from "./CreateButton";

interface Contact {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt: string;
  totalValue: string | null;
  isActive: boolean;
}

interface Stats {
  totalContacts: number;
  activeContacts: number;
  totalValue: string;
  conversionRate: number;
}

interface ContactsClientProps {
  subaccountId: string;
  subaccountName: string;
  contacts: Contact[];
  stats: Stats;
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default function ContactsClient({
  subaccountId,
  subaccountName,
  contacts,
  stats,
}: ContactsClientProps) {
  const router = useRouter();
  const { setOpen } = useModal();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "inactive">("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Filter by tab
    if (activeTab === "active") {
      filtered = filtered.filter(c => c.isActive);
    } else if (activeTab === "inactive") {
      filtered = filtered.filter(c => !c.isActive);
    }

    // Filter by search query
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [contacts, query, activeTab]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      toast.success("Contacts refreshed");
    } catch (error) {
      toast.error("Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!selectedContact) return;
    
    try {
      await deleteContact(selectedContact.id, subaccountId);
      toast.success(`Contact ${selectedContact.name} deleted`);
      router.refresh();
    } catch (error) {
      toast.error("Failed to delete contact");
    } finally {
      setDeleteDialogOpen(false);
      setSelectedContact(null);
    }
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success("Email copied to clipboard");
  };

  const handleExport = () => {
    const data = filteredContacts.map(c => ({
      name: c.name,
      email: c.email,
      status: c.isActive ? 'Active' : 'Inactive',
      totalValue: c.totalValue || '0',
      created: format(new Date(c.createdAt), 'dd/MM/yyyy'),
    }));
    
    const csv = [
      ['Name', 'Email', 'Status', 'Total Value', 'Created'],
      ...data.map(row => [row.name, row.email, row.status, row.totalValue, row.created])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${subaccountName}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success("Contacts exported");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0F1E] via-[#0F1425] to-[#0A0F1E]">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#4F46E5]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#7C3AED]/20 rounded-full blur-3xl animate-pulse animation-delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#DB2777]/10 rounded-full blur-3xl animate-pulse animation-delay-2000" />
      </div>

      {/* Premium Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#DB2777] opacity-90 animate-gradient-x bg-[length:200%_200%]" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />
        
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse animation-delay-1000" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity" />
                <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl">
                  <Users className="w-5 h-5 text-white" />
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">Contacts</h1>
                  <Badge className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-white border-white/10 backdrop-blur-sm px-2 py-0.5 text-xs">
                    <Crown className="w-3 h-3 mr-1 text-amber-300" />
                    {subaccountName}
                  </Badge>
                </div>
                <p className="text-white/70 text-xs flex items-center">
                  Manage your contacts and their information
                  <ChevronRight className="w-3 h-3 ml-1 text-white/40" />
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
                  <span className="text-xs text-white/80">Live</span>
                </div>
                <Separator orientation="vertical" className="h-4 bg-white/20" />
                <div className="flex items-center space-x-1">
                  <Activity className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-xs font-medium text-white">{stats.totalContacts}</span>
                </div>
              </div>

              <div className="hidden md:flex items-center space-x-2 bg-white/5 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10">
                <Clock className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs text-white/80">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Pills */}
          <div className="flex items-center gap-1.5 mt-4">
            {[
              { icon: LayoutDashboard, label: 'Dashboard', active: false, color: 'from-indigo-500 to-purple-600' },
              { icon: Users, label: 'Contacts', active: true, color: 'from-purple-500 to-pink-600' },
              { icon: Settings, label: 'Settings', active: false, color: 'from-pink-500 to-rose-600' },
              { icon: BarChart3, label: 'Analytics', active: false, color: 'from-amber-500 to-orange-600' },
            ].map((item, index) => (
              <button
                key={index}
                className={`group relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 overflow-hidden ${
                  item.active
                    ? 'text-white shadow-lg'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {item.active && (
                  <>
                    <div className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-100`} />
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-sm mix-blend-overlay" />
                    <div className="absolute inset-0 shadow-inner shadow-white/20" />
                  </>
                )}
                
                {!item.active && (
                  <>
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-300" />
                    <div className="absolute inset-0 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                  </>
                )}
                
                <span className="relative flex items-center gap-1.5">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </span>

                {item.active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full shadow-lg shadow-white/50" />
                )}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-medium text-amber-400">PRO</span>
                </div>
              </div>
              <div className="px-2 py-1 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-medium text-emerald-400">{stats.activeContacts} ACTIVE</span>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/50">Total Contacts</p>
                <p className="text-base font-bold text-white mt-0.5">{stats.totalContacts}</p>
              </div>
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20">
                <Users className="w-3.5 h-3.5 text-blue-400" />
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/50">Active Contacts</p>
                <p className="text-base font-bold text-white mt-0.5">{stats.activeContacts}</p>
              </div>
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/50">Total Value</p>
                <p className="text-base font-bold text-white mt-0.5">{stats.totalValue}</p>
              </div>
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                <IndianRupee className="w-3.5 h-3.5 text-purple-400" />
              </div>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-white/50">Conversion Rate</p>
                <p className="text-base font-bold text-white mt-0.5">{stats.conversionRate}%</p>
              </div>
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Tabs defaultValue="all" className="w-auto" value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="bg-white/5 border border-white/10">
              <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#4F46E5] data-[state=active]:to-[#7C3AED] data-[state=active]:text-white">
                All
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white">
                Active
              </TabsTrigger>
              <TabsTrigger value="inactive" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white">
                Inactive
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
              <Input
                placeholder="Search contacts..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 w-64 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-lg text-xs h-8"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/5 h-8 px-2">
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  <span className="text-xs">Filter</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1A1F3A] border-white/10 text-white">
                <DropdownMenuLabel className="text-xs">Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="text-xs" onClick={() => setActiveTab("all")}>
                  All
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => setActiveTab("active")}>
                  Active
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs" onClick={() => setActiveTab("inactive")}>
                  Inactive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white/60 hover:text-white hover:bg-white/5 h-8 px-2"
              onClick={handleExport}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">Export</span>
            </Button>

            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white/60 hover:text-white hover:bg-white/5 h-8 px-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-xs">Sync</span>
            </Button>

            <CreateContactButton subAccountId={subaccountId} />
          </div>
        </div>

        {/* Results count */}
        <p className="text-[10px] text-white/30 mb-3">
          Showing {filteredContacts.length} of {contacts.length} contacts
          {query && ` matching "${query}"`}
        </p>

        {/* Contacts Table */}
        <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-white/30 text-[10px] w-[80px]">Avatar</TableHead>
                  <TableHead className="text-white/30 text-[10px]">Name</TableHead>
                  <TableHead className="text-white/30 text-[10px]">Email</TableHead>
                  <TableHead className="text-white/30 text-[10px]">Status</TableHead>
                  <TableHead className="text-white/30 text-[10px]">Created Date</TableHead>
                  <TableHead className="text-white/30 text-[10px]">Total Value</TableHead>
                  <TableHead className="text-white/30 text-[10px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact) => (
                    <TableRow key={contact.id} className="border-white/10 hover:bg-white/5 group">
                      <TableCell>
                        <Avatar className="h-8 w-8 ring-2 ring-[#4F46E5]/30">
                          <AvatarImage src={contact.avatarUrl || ""} alt={contact.name} />
                          <AvatarFallback className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white text-xs">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="text-white text-xs font-medium">
                        {contact.name}
                      </TableCell>
                      <TableCell className="text-white/70 text-xs">
                        {contact.email}
                      </TableCell>
                      <TableCell>
                        {contact.isActive ? (
                          <Badge className="!border-emerald-400/30 !bg-emerald-950/80 !text-emerald-200 text-[10px] px-1.5 py-0 shadow-sm shadow-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="!border-amber-400/30 !bg-amber-950/80 !text-amber-200 text-[10px] px-1.5 py-0 shadow-sm shadow-amber-500/20">
                            <XCircle className="w-2.5 h-2.5 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-white/50 text-[10px]">
                        {format(new Date(contact.createdAt), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-white text-xs font-medium">
                        {contact.totalValue || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-white/40 hover:text-white">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-[#1A1F3A] border-white/10 text-white">
                            <DropdownMenuItem className="text-xs hover:bg-white/5">
                              <Eye className="w-3 h-3 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs hover:bg-white/5">
                              <button
                                type="button"
                                className="flex w-full items-center"
                                onClick={() => setOpen(
                                  <ContactDetails subAccountId={subaccountId} />,
                                  async () => ({ contact })
                                )}
                              >
                                <Edit className="w-3 h-3 mr-2" /> Edit
                              </button>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs hover:bg-white/5" onClick={() => handleCopyEmail(contact.email)}>
                              <Copy className="w-3 h-3 mr-2" /> Copy Email
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs hover:bg-white/5">
                              <Mail className="w-3 h-3 mr-2" /> Send Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem 
                              className="text-xs text-red-400 hover:bg-red-500/10"
                              onClick={() => {
                                setSelectedContact(contact);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-3 h-3 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-[#4F46E5]/20 to-[#7C3AED]/20 flex items-center justify-center">
                          <Users className="w-6 h-6 text-white/40" />
                        </div>
                        <p className="text-white font-medium mb-1">
                          {query ? "No matching contacts" : "No contacts yet"}
                        </p>
                        <p className="text-xs text-white/30 max-w-md text-center mb-4">
                          {query 
                            ? "Try adjusting your search or filter to find what you're looking for."
                            : "Get started by creating your first contact."}
                        </p>
                        {query ? (
                          <Button 
                            variant="ghost" 
                            onClick={() => setQuery("")}
                            className="text-white/60 hover:text-white hover:bg-white/5"
                          >
                            Clear Search
                          </Button>
                        ) : (
                          <CreateContactButton subAccountId={subaccountId} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-500">
                <Trash2 className="w-4 h-4 text-white" />
              </div>
              Delete Contact
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Are you sure you want to delete{' '}
              <span className="text-white font-semibold">{selectedContact?.name}</span>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-3 h-3" />
              This will permanently remove the contact and all associated data.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 text-white border-white/10 hover:bg-white/10 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              className="bg-gradient-to-r from-red-500 to-rose-600 text-white"
            >
              Delete Contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animate-gradient-x {
          animation: gradient-x 15s ease infinite;
        }
      `}</style>
    </div>
  );
}
