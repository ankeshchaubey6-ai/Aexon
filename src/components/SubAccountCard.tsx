"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Building2, 
  Users, 
  MapPin, 
  Calendar,
  MoreVertical,
  Edit,
  Copy,
  ExternalLink,
  Settings,
  Mail,
  Phone,
  UserPlus,
  Activity
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import DeleteButton from "@/DeleteButton";

// Define the SubAccount type based on your Prisma schema
interface SubAccount {
  id: string;
  name: string;
  subAccountLogo: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  address: string | null;
  createdAt: Date;
  // Add other fields as needed
}

interface SubAccountCardProps {
  subAccount: SubAccount;
}

const SubAccountCard: React.FC<SubAccountCardProps> = ({ subAccount }) => {
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  return (
    <AlertDialog>
      <Card className="border-0 bg-gradient-to-br from-[#1A1F3A]/90 to-[#0F1425]/90 backdrop-blur-xl shadow-2xl overflow-hidden group hover:scale-[1.01] transition-all duration-300">
        <CardContent className="p-0">
          <div className="flex items-center p-4 relative">
            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5]/0 via-[#7C3AED]/0 to-[#DB2777]/0 group-hover:from-[#4F46E5]/5 group-hover:via-[#7C3AED]/5 group-hover:to-[#DB2777]/5 transition-all duration-500" />
            
            {/* Logo Section */}
            <Link
              href={`/subaccount/${subAccount.id}`}
              className="flex items-center gap-4 w-full relative z-10"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-opacity" />
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] border border-white/10 group-hover:border-white/20 transition-all">
                  {subAccount.subAccountLogo ? (
                    <Image
                      src={subAccount.subAccountLogo}
                      alt={subAccount.name}
                      fill
                      className="object-contain p-2"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#4F46E5] to-[#7C3AED]">
                      <span className="text-white text-lg font-semibold">
                        {getInitials(subAccount.name)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Details Section */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-white">
                    {subAccount.name}
                  </h3>
                  <Badge className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-0 text-[10px]">
                    <Activity className="w-2 h-2 mr-1" />
                    Active
                  </Badge>
                  <Badge className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border-0 text-[10px]">
                    Premium
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  {subAccount.address && (
                    <div className="flex items-center gap-1 text-white/50">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{subAccount.address}</span>
                    </div>
                  )}
                  {subAccount.companyEmail && (
                    <div className="flex items-center gap-1 text-white/50">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{subAccount.companyEmail}</span>
                    </div>
                  )}
                  {subAccount.companyPhone && (
                    <div className="flex items-center gap-1 text-white/50">
                      <Phone className="w-3 h-3" />
                      <span>{subAccount.companyPhone}</span>
                    </div>
                  )}
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1 text-[10px] text-white/30">
                    <Calendar className="w-2.5 h-2.5" />
                    Created {new Date(subAccount.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-white/30">
                    <Users className="w-2.5 h-2.5" />
                    12 team members
                  </div>
                </div>
              </div>
            </Link>

            {/* Actions Section */}
            <div className="flex items-center gap-2 relative z-10 ml-4">
              <Button
                size="sm"
                variant="ghost"
                className="text-white/60 hover:text-white hover:bg-white/5"
                asChild
              >
                <Link href={`/subaccount/${subAccount.id}/settings`}>
                  <Settings className="w-4 h-4" />
                </Link>
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                className="text-white/60 hover:text-white hover:bg-white/5"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white/60 hover:text-white hover:bg-white/5"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#1A1F3A] border-white/10 text-white">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem className="hover:bg-white/5 cursor-pointer">
                    <Edit className="w-3 h-3 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="hover:bg-white/5 cursor-pointer">
                    <Copy className="w-3 h-3 mr-2" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem className="hover:bg-white/5 cursor-pointer">
                    <UserPlus className="w-3 h-3 mr-2" /> Add Member
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  
                  {/* This is the AlertDialogTrigger that opens the modal */}
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem 
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
                    >
                      Delete
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <AlertDialogContent className="bg-gradient-to-br from-[#1A1F3A] to-[#0F1425] border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-lg flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-r from-red-500 to-rose-500">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            Delete Sub Account
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/60">
            This action cannot be undone. This will permanently delete{' '}
            <span className="text-white font-semibold">{subAccount.name}</span>{' '}
            and all associated data.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400 flex items-center gap-2">
            <span className="w-1 h-1 bg-red-400 rounded-full" />
            This includes all projects, team members, and historical data
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 text-white border-white/10 hover:bg-white/10 hover:text-white">
            Cancel
          </AlertDialogCancel>
          <DeleteButton subAccountId={subAccount.id} />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SubAccountCard;