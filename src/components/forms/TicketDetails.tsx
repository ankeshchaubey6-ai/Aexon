"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Check,
  ChevronsUpDownIcon,
  User2,
  Ticket,
  Tag,
  DollarSign,
  FileText,
  Users,
  Save,
  Sparkles,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { Contact, Tag as TagType, User } from "@prisma/client";

import { getSubAccountTeamMembers } from "@/queries/subaccount";
import { searchContacts } from "@/queries/contacts";
import { saveActivityLogsNotification } from "@/queries/notifications";
import { upsertTicket } from "@/queries/tickets";

import { useModal } from "@/hooks/use-modal";
import type { TicketsWithTags } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "../ui/command";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import TagDetails from "./TagDetails";

import {
  type TicketDetailsSchema,
  TicketDetailsValidator,
} from "@/lib/validators/ticket-details";
import { cn } from "@/lib/utils";

interface TicketDetailsProps {
  laneId: string;
  subAccountId: string;
  getNewTicket: (ticket: TicketsWithTags[0]) => void;
}

const TicketDetails: React.FC<TicketDetailsProps> = ({
  getNewTicket,
  laneId,
  subAccountId,
}) => {
  const router = useRouter();
  const { data, setClose } = useModal();

  const ticket = data?.ticket;

  const [tags, setTags] = React.useState<TagType[]>(ticket?.tags ?? []);
  const [contactList, setContactList] = React.useState<Contact[]>([]);
  const [allTeamMembers, setAllTeamMembers] = React.useState<User[]>([]);
  const [contactId, setContactId] = React.useState<string>(
    ticket?.customerId ?? ""
  );
  const [search, setSearch] = React.useState<string>("");
  const [assignedTo, setAssignedTo] = React.useState<string>(
    ticket?.assignedUserId ?? ""
  );

  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  const form = useForm<TicketDetailsSchema>({
    resolver: zodResolver(TicketDetailsValidator),
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      value: "0",
    },
  });

  const formErrors = form.formState.errors;

  // SAFE RESET WHEN EDITING TICKET
  React.useEffect(() => {
    if (ticket) {
      form.reset({
        name: ticket.name ?? "",
        description: ticket.description ?? "",
        value: ticket.value ? String(ticket.value) : "0",
      });

      setContactId(ticket.customerId ?? "");
      setTags(ticket.tags ?? []);
      setAssignedTo(ticket.assignedUserId ?? "");
    }
  }, [ticket, form]);

  // FETCH TEAM MEMBERS
  React.useEffect(() => {
    if (!subAccountId) return;

    const fetchMembers = async () => {
      try {
        const res = await getSubAccountTeamMembers(subAccountId);
        if (res) setAllTeamMembers(res);
      } catch (err) {
        console.error("Team fetch error:", err);
      }
    };

    fetchMembers();
  }, [subAccountId]);

  // SEARCH CONTACTS (DEBOUNCED)
  const handleSearchContacts = (value: string) => {
    setSearch(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      if (!value.trim()) {
        setContactList([]);
        return;
      }

      try {
        const res = await searchContacts(value);
        setContactList(res ?? []);
      } catch (err) {
        console.error("Contact search error:", err);
      }
    }, 500);
  };

  const selectedContactName =
    contactList.find((c) => c.id === contactId)?.name ||
    ticket?.customer?.name ||
    "Select customer...";

  const onSubmit: SubmitHandler<TicketDetailsSchema> = async (values) => {
    console.log("SUBMIT VALUES:", values);

    if (!laneId) {
      toast.error("Lane not found");
      return;
    }

    const safeName = values.name?.trim();

    if (!safeName) {
      toast.error("Ticket name is required");
      return;
    }

    try {
      const response = await upsertTicket(
        {
          id: ticket?.id,
          name: safeName,
          description: values.description ?? "",
          value: values.value ?? "0",
          laneId,
          assignedUserId: assignedTo || null,
          customerId: contactId || null,
        },
        tags
      );

      await saveActivityLogsNotification({
        agencyId: undefined,
        description: `Saved a ticket | ${response?.name}`,
        subAccountId,
      });

      toast.success(
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="font-semibold">Ticket saved successfully!</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{response?.name} has been updated</p>
          </div>
        </div>
      );

      if (response) {
        getNewTicket(response);
      }

      setClose();
      router.refresh();
    } catch (error: any) {
      console.error("Ticket save error:", error);
      toast.error(
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-rose-500" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Could not save ticket details</p>
          </div>
        </div>
      );
    }
  };

  const isLoading = form.formState.isSubmitting;

  return (
    <TooltipProvider>
      <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600" />
          
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
                  <Ticket className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-900 dark:text-white">
                    {ticket?.id ? "Edit Ticket" : "Create Ticket"}
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                    {ticket?.id ? "Update ticket details and assignments" : "Add a new ticket to this lane"}
                  </CardDescription>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 gap-1"
              >
                <Sparkles className="w-3 h-3" />
                {ticket?.id ? "Edit Mode" : "Create Mode"}
              </Badge>
            </div>

            {/* Quick Stats */}
            {ticket?.id && (
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                <div className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span>{tags.length} tags</span>
                </div>
                {assignedTo && (
                  <div className="flex items-center gap-1">
                    <User2 className="w-3 h-3" />
                    <span>Assigned</span>
                  </div>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Error Summary */}
            {Object.keys(formErrors).length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-xs font-medium">Please fix the following errors:</p>
                </div>
                <ul className="mt-1 list-disc list-inside text-xs text-red-600 dark:text-red-400">
                  {Object.entries(formErrors).map(([field, error]) => (
                    <li key={field}>{field}: {error.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {/* NAME */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-blue-600" />
                        Ticket Name
                        <span className="text-red-500">*</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">A descriptive name for this ticket</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Design feedback, Bug report"
                          className={`h-10 text-sm border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${
                            formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : ""
                          }`}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* DESCRIPTION */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-cyan-600" />
                        Description
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add details about this ticket..."
                          className="min-h-[80px] text-sm border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 resize-none"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* VALUE */}
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                        Ticket Value
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                          <Input
                            placeholder="0"
                            className="h-10 pl-7 text-sm border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                            {...field}
                            value={field.value ?? "0"}
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        Estimated value of this ticket
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* TAGS */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Tags</h3>
                  </div>
                  <TagDetails
                    subAccountId={subAccountId}
                    getSelectedTags={setTags}
                    defaultTags={ticket?.tags ?? []}
                  />
                </div>

                <Separator className="bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

                {/* ASSIGNED USER */}
                <FormItem>
                  <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-600" />
                    Assigned To
                  </FormLabel>
                  <Select
                    value={assignedTo}
                    onValueChange={setAssignedTo}
                  >
                    <FormControl>
                      <SelectTrigger className="h-10 text-sm border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20">
                        <SelectValue placeholder="Not assigned" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allTeamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-5 h-5">
                              <AvatarImage src={member.avatarUrl || ""} />
                              <AvatarFallback className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-[10px]">
                                {member.name?.charAt(0) || <User2 className="w-3 h-3" />}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{member.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>

                {/* CUSTOMER SELECTOR */}
                <FormItem>
                  <FormLabel className="text-sm font-medium flex items-center gap-1.5">
                    <User2 className="w-3.5 h-3.5 text-indigo-600" />
                    Customer
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between h-10 text-sm font-normal border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <span className={cn(
                            "truncate",
                            !contactId && "text-slate-500"
                          )}>
                            {selectedContactName}
                          </span>
                          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>

                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search customers..."
                          value={search}
                          onValueChange={handleSearchContacts}
                          className="h-9"
                        />
                        <CommandEmpty className="py-2 text-center text-sm text-slate-500">
                          No customers found.
                        </CommandEmpty>
                        <CommandGroup className="max-h-[200px] overflow-y-auto">
                          {contactList.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              value={contact.id}
                              onSelect={() => {
                                setContactId(contactId === contact.id ? "" : contact.id);
                              }}
                              className="flex items-center gap-2 py-2"
                            >
                              <Avatar className="w-5 h-5">
                                <AvatarFallback className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-[10px]">
                                  {contact.name?.charAt(0) || <User2 className="w-3 h-3" />}
                                </AvatarFallback>
                              </Avatar>
                              <span className="flex-1 text-sm">{contact.name}</span>
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  contactId === contact.id
                                    ? "opacity-100 text-blue-600"
                                    : "opacity-0"
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FormItem>

                <Separator className="my-4" />

                {/* SAVE BUTTON */}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setClose()}
                    size="sm"
                    className="h-9 px-4 text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    size="sm"
                    className="h-9 px-4 text-xs bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-700 hover:via-cyan-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {isLoading ? "Saving..." : ticket?.id ? "Update Ticket" : "Create Ticket"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default TicketDetails;