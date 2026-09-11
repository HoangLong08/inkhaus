"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CUSTOMER_COMPANY_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTE_MAX,
  CUSTOMER_PHONE_MAX,
} from "@inkhaus/shared/admin";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerDetail } from "@/lib/api";
import { ClientApiError, clientApi } from "@/lib/client-api";
import { queryKeys } from "@/lib/query-keys";
import { customerEditInputSchema, type CustomerEditInput } from "@/lib/schemas/forms";

const FIELDS = ["name", "phone", "company", "adminNote"] as const;

/** what the form starts from: the stored values, with "not known" as an empty box */
function valuesOf(customer: CustomerDetail): Required<CustomerEditInput> {
  return {
    name: customer.name ?? "",
    phone: customer.phone ?? "",
    company: customer.company ?? "",
    adminNote: customer.adminNote ?? "",
  };
}

/** what the API will store for an edit: an emptied field is null, not "" */
function asStored(input: CustomerEditInput): Partial<CustomerDetail> {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([field, value]) => [field, value || null]),
  );
}

export default function CustomerEditDialog({ customer }: { customer: CustomerDetail }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const key = queryKeys.customers.detail(customer.id);

  const form = useForm<CustomerEditInput>({
    resolver: zodResolver(customerEditInputSchema),
    defaultValues: valuesOf(customer),
  });

  const mutation = useMutation({
    mutationFn: (input: CustomerEditInput) => clientApi.customers.update(customer.id, input),

    // The heading and the profile card both read this entry, so the edit shows
    // behind the dialog before the API has answered.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CustomerDetail>(key);
      queryClient.setQueryData<CustomerDetail>(key, (current) =>
        current ? { ...current, ...asStored(input) } : current,
      );
      return { previous };
    },

    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      // 401 already redirected inside clientApi; a toast would flash at a page
      // that is on its way out.
      if (error instanceof ClientApiError && error.status === 401) return;
      // The dialog stays open with what was typed, so nothing needs retyping.
      toast.error("Could not save the customer", { description: error.message });
    },

    onSuccess: (updated) => {
      queryClient.setQueryData(key, updated);
      toast.success("Customer saved");
      setOpen(false);
    },

    // No router.refresh(): nothing server rendered on the profile shows an
    // editable field - the heading and the profile card are the client leaves.
    // Order screens do show the customer's name, so their cache goes too.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
    },
  });

  function onOpenChange(next: boolean) {
    // start from what is stored now, not from what was typed and abandoned last time
    if (next) form.reset(valuesOf(customer));
    setOpen(next);
  }

  function onSubmit(values: CustomerEditInput) {
    // Only what this person changed. Sending all four would put back a note a
    // colleague saved while this dialog sat open.
    const dirty = form.formState.dirtyFields;
    const changed: CustomerEditInput = Object.fromEntries(
      FIELDS.filter((field) => dirty[field]).map((field) => [field, values[field]]),
    );
    if (Object.keys(changed).length === 0) {
      setOpen(false);
      return;
    }
    mutation.mutate(changed);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="customer-edit-open">
          <Pencil />
          Edit
        </Button>
      </DialogTrigger>

      <DialogContent data-testid="customer-edit-dialog">
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>
            {customer.email} - the address is how orders and sign-in find this customer, so it
            cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      maxLength={CUSTOMER_NAME_MAX}
                      data-testid="customer-name"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        autoComplete="off"
                        maxLength={CUSTOMER_PHONE_MAX}
                        data-testid="customer-phone"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        maxLength={CUSTOMER_COMPANY_MAX}
                        data-testid="customer-company"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="adminNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Staff note</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      maxLength={CUSTOMER_NOTE_MAX}
                      placeholder="Payment terms, preferences, who to ask for…"
                      data-testid="customer-note"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription className="flex justify-between gap-4">
                    <span>Staff only - never shown to the customer.</span>
                    <span className="tabular-nums">
                      {field.value?.length ?? 0}/{CUSTOMER_NOTE_MAX}
                    </span>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" data-testid="customer-edit-cancel">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending} data-testid="customer-save">
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
