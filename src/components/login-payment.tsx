"use client";
import { IconButton, Logo } from "@/components";
import {
  RightArrow,
  Discord,
  Typescript2,
  Document,
  Info,
  Github,
} from "@/icons";
import { FormatDate } from "@/utils";
import { postSignUp } from "@/utils/sign_up_api";
import { useParams, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { validateGithubUsername } from "@/utils/validate_github";
import DennisAvatar from "@/assets/images/dennis-avatar.svg";
import prochatLogoColor from "@/assets/images/prochat-logo.png";
import Image from "next/image";

const links = [
  {
    icon: <Typescript2 />,
    name: "Typescript repo",
    link: "https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html",
  },
  {
    icon: <Document />,
    name: "Documentation",
    link: "https://docs.microsaasfast.me/",
  },
];

const LoginPayment = ({ user }: any) => {
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmited, setIsSubmited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const params = useParams();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("invoice") === "true") {
      setIsInvoiceOpen(true); // Open the modal if invoice=true in search params
    }
  }, [searchParams]);

  const downloadAsPDF = () => {
    const content = document.getElementById("invoice-modal");
    if (content) {
      html2canvas(content).then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        const pdfWidth = 150;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const pdf = new jsPDF("p", "mm", "a4");
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(user?.stripeName + " Invoice.pdf");
      });
    }
  };

  const handleClick = async () => {
    setIsLoading(true);
    const resp = await postSignUp(username, params?.token);
    if (resp?.email) {
      toast.success(
        "Access to the GitHub repo has been granted. You should receive the invitation shortly."
      );
    }
    setIsSubmited(true);
    setUsername("");
    setIsLoading(false);
    setIsDialogOpen(false);
  };

  const validateGithub = async () => {
    if (!username || username?.length === 0) {
      setError("Username is required");
      return;
    }
    setIsLoading(true);
    try {
      const resp = await validateGithubUsername(username);
      if (resp === "Not Found") {
        setError("This GitHub user name was not found, please try again");
        return;
      }
      setError("");
      setIsDialogOpen(true);
    } catch (error) {
      setError("Failed to validate username");
    }
    setIsLoading(false);
  };

  return (
    <div className="flex justify-center items-center mt-40 mb-24 bg-white dark:bg-[#010814] w-full">
      <div className="max-w-[1440px] w-full px-4 sm:px-12">
        <div className="flex flex-col lg:flex-row items-center justify-between w-full gap-y-16">
          <div className="w-full sm:w-[500px] lg:w-[45%]">
            {!isSubmited ? (
              <div>
                <div
                  className={`text-black1 dark:text-white text-[20px] sm:text-[32px] leading-[20px] sm:leading-[32px] font-semibold mb-4 flex items-center gap-2`}
                >
                  <Logo isLarge={true} /> Boilerplate
                </div>
                <p className="text-[#7B7E83] dark:text-[#808389] font-medium text-base mb-8">
                  Enter your{" "}
                  <span className="text-black1 dark:text-white font-bold">
                    GitHub user name
                  </span>{" "}
                  to get access to the repo.
                  <br />
                  You`ll receive an email from GitHub to confirm your access
                </p>
                <Toaster />
                <div className="w-full flex flex-col sm:flex-row gap-y-4 gap-x-2">
                  <div>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e: any) => setUsername(e.target.value)}
                      placeholder="User name"
                      className="border border-[#86898E] h-[50px] sm:h-full dark:border-[#5A5E66] w-full text-black1 dark:text-white placeholder-[#B7B8BB] dark:placeholder-[#4D525A] rounded-[8px] px-3 text-base font-medium bg-transparent"
                    />
                    {error?.length > 0 && (
                      <p className="text-[#EA2222] dark:text-[#FF4242] text-sm font-medium mt-2 flex items-center gap-2">
                        <Info /> {error}
                      </p>
                    )}
                  </div>
                  <div className="w-fit">
                    <div
                      className="w-full flex justify-end"
                      onClick={validateGithub}
                    >
                      <IconButton
                        text="Request Access"
                        icon={<RightArrow />}
                        isSubmit={false}
                      />
                    </div>
                    {isDialogOpen && (
                      <Dialog
                        open={isDialogOpen}
                        onOpenChange={setIsDialogOpen}
                      >
                        <DialogContent className="overflow-y-scroll bg-white dark:bg-gradient-to-r from-[#1E242D] to-[#0B111B] max-h-[90vh] max-w-[500px] w-full">
                          <div className="mx-auto w-fit text-black1 dark:text-white">
                            <Github />
                          </div>
                          <div>
                            <p className="text-black1 dark:text-white text-[20px] leading-[20px] font-medium text-center sm:whitespace-nowrap mb-1">
                              It&apos;s your username “
                              <span className="text-bold">{username}</span>”
                            </p>
                            <p className="text-base font-medium text-[#7B7E83] dark:text-[#5A5E66] text-center">
                              Make sure you entered your GitHub username
                            </p>
                          </div>
                          <DialogFooter className="flex sm:justify-end">
                            <DialogClose asChild>
                              <div>
                                <IconButton text="Cancel" />
                              </div>
                            </DialogClose>
                            <div
                              className="text-white mb-4 sm:mb-0"
                              onClick={handleClick}
                            >
                              <IconButton
                                isLoading={isLoading}
                                text="Request access"
                                isSubmit={true}
                              />
                            </div>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div
                  className={`text-black1 dark:text-white text-[20px] sm:text-[32px] leading-[20px] sm:leading-[32px] font-semibold mb-4`}
                >
                  Thank you!
                  <br />
                  Please check you email
                </div>
                <p className="text-[#7B7E83] dark:text-[#808389] font-medium text-xl mb-8">
                  {user?.stripeEmail?.slice(0, 2)}*******@gmail.com
                </p>
                <div className="bg-white dark:bg-gradient-to-r from-[#1E242D] to-[#0B111B] px-4 py-3 rounded-[12px] border-l-2 border-r-0 border-[#F1AF33] shadow-[0_0_20px_rgba(0,0,0,0.25)]">
                  <div className="flex items-center gap-2 text-[#F1AF33]">
                    <Info />
                    <p className="text-[#7B7E83] dark:text-[#808389] font-medium">
                      <span className="text-black1 dark:text-white font-semibold">
                        Check your SPAM
                      </span>{" "}
                      folder if you don’t see our reply
                    </p>
                  </div>
                </div>
              </div>
            )}
            <p className="text-[#7B7E83] dark:text-[#808389] font-medium text-base mt-8 mb-4">
              Issues? Drop me a line{" "}
              <a
                href="mailto:hello@db2.io"
                target="_blank"
                className="text-[#010610] dark:text-white hover:underline"
              >
                hello@db2.io
              </a>{" "}
              or on{" "}
              <a
                href="https://discord.gg/U75p2BQuAH"
                target="_blank"
                className="text-[#7289DA] hover:underline"
              >
                Discord
              </a>
            </p>
            <a
              href="https://discord.gg/U75p2BQuAH"
              target="_blank"
              className="w-fit block"
            >
              <button className="bg-[#7289DA] w-fit min-w-[220px] rounded-[8px] text-sm font-semibold text-white flex items-center gap-3 justify-center py-3">
                Join Discord{" "}
                <span>
                  <Discord />
                </span>
              </button>
            </a>
          </div>
          <div className="w-full sm:w-[500px] lg:w-[45%] xl:w-[40%] bg-white dark:bg-gradient-to-r from-[#1E242D] to-[#0B111B] p-8 rounded-[16px] shadow-[0_0_20px_rgba(0,0,0,0.25)]">
            {links && (
              <div className="w-full flex flex-col sm:flex-row gap-4 mb-6">
                {links?.map((item: any, index: number) => (
                  <div key={index} className={`flex items-center gap-2 mb-3`}>
                    <div className="text-black1 dark:text-white">
                      {item?.icon}
                    </div>
                    <a
                      href={
                        index === 0 && user?.stripeEmail
                          ? user?.amountPaid === "247"
                            ? "https://github.com/yeshuaacademy/finance"
                            : "https://github.com/yeshuaacademy/finance"
                          : item?.link
                      }
                      target="_blank"
                      className={`text-black1 dark:text-white font-medium text-base ${
                        index === 0 ? "sm:border-r sm:pr-4" : "border-r-0"
                      }`}
                    >
                      {item?.name}
                    </a>
                  </div>
                ))}
              </div>
            )}
            <div className="w-full py-8 border-y border-[#EBEBEB] dark:border-[#31353D]">
              <p className="font-semibold text-xl text-black1 dark:text-white mb-2">
                Build with 2 000+ makers
              </p>
              <a href="https://discord.gg/U75p2BQuAH" target="_blank">
                <button className="bg-[#7289DA] w-full rounded-[8px] text-sm font-semibold text-white flex items-center gap-3 justify-center py-3">
                  Join Discord{" "}
                  <span>
                    <Discord />
                  </span>
                </button>
              </a>
            </div>
            <div className="my-8 flex gap-4">
              <Image
                src={DennisAvatar}
                alt="profile-pic"
                className="w-[77px] h-[77px] rounded-full"
              />
              <div className="min-h-full flex flex-col justify-between gap-4">
                <p className="text-lg text-black1 dark:text-white font-medium">
                  Please! Please! Please!
                </p>
                <p className="text-base font-medium text-[#7B7E83] dark:text-[#5A5E66]">
                  Create only one feature and launch your micro SaaS today! I
                  believe in you!
                </p>
              </div>
            </div>
            <div>
              <Dialog open={isInvoiceOpen} onOpenChange={setIsInvoiceOpen}>
                <DialogTrigger asChild>
                  <div className="w-full flex justify-end">
                    <div
                      className={`w-fit ${
                        user?.stripeEmail ? "block" : "hidden"
                      }`}
                    >
                      <IconButton text="Download" />
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="overflow-y-scroll bg-white max-h-[90vh] max-w-[650px] w-full">
                  <div
                    id="invoice-modal"
                    style={{
                      maxWidth: "1000px",
                      margin: "60px auto 30px auto",
                      padding: "16px",
                    }}
                  >
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <tbody>
                        <tr>
                          <td style={{ padding: "10px 0" }}>
                            <h1
                              style={{
                                margin: "0",
                                color: "#000",
                                fontSize: "30px",
                              }}
                            >
                              Receipt
                            </h1>
                            <h4 style={{ margin: "5px 0 0", color: "#333" }}>
                              Invoice number: {user?.id}
                            </h4>
                            <h4 style={{ margin: "5px 0 0", color: "#333" }}>
                              Receipt number: 2686-1458
                            </h4>
                            <h4 style={{ margin: "5px 0 0", color: "#333" }}>
                              Date paid: {FormatDate(user?.publishedAt)}
                            </h4>
                            <h4 style={{ margin: "5px 0 0", color: "#333" }}>
                              Payment method: Visa - 8517
                            </h4>
                          </td>
                          <td
                            style={{
                              padding: "10px 0",
                              textAlign: "right",
                              display: "flex",
                              alignItems: "flex-end",
                            }}
                          >
                            <Image
                              src={prochatLogoColor}
                              alt="ProChat logo"
                              width={180}
                              height={58}
                              style={{ marginTop: "30px", height: "auto" }}
                              priority
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <hr
                      style={{
                        border: "0",
                        borderTop: "1px solid #eee",
                        margin: "20px 0",
                      }}
                    />
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <tbody>
                        <tr>
                          <td style={{ padding: "10px 80px 10px 0px" }}>
                            <h3
                              style={{
                                margin: "0",
                                color: "#000",
                                // fontWeight: "500",
                                fontSize: "16px",
                              }}
                            >
                              DB2 SOFTWARE LTD, 38 Fawkner Way, Stanford In The
                              Vale, Faringdon, United Kingdom, SN7 8FF
                            </h3>
                            {/* <h4 style={{ margin: "5px 0 0", color: "#333" }}>
                                +44 7949 100738
                              </h4>
                              <h4 style={{ margin: "5px 0 0", color: "#333" }}>
                                microsaasfast@gmail.com
                              </h4> */}
                          </td>
                          <td
                            style={{
                              padding: "10px 0",
                            }}
                          >
                            <h3
                              style={{
                                margin: "0",
                                color: "#000",
                                fontSize: "18px",
                              }}
                            >
                              Bill to
                            </h3>
                            <h4 style={{ margin: "5px 0 0", color: "#333" }}>
                              {user?.stripeName}
                            </h4>
                            <h4 style={{ margin: "5px 0 0", color: "#333" }}>
                              {user?.stripeEmail}
                            </h4>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <h2
                      style={{
                        fontSize: "30px",
                        margin: "20px 0px",
                        color: "#000",
                      }}
                    >
                      ${parseFloat(user?.amountPaid).toFixed(2)} paid on{" "}
                      {FormatDate(user?.publishedAt)}
                    </h2>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        marginTop: "20px",
                      }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: "#f8f8f8" }}>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              color: "#000",
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            Description
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              color: "#000",
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            Qty
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              color: "#000",
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            Unit price
                          </th>
                          <th
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              color: "#000",
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #eee",
                              color: "#000",
                            }}
                          >
                            {user?.amountPaid === "210" ? "Standard" : "All-in"}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #eee",
                              color: "#000",
                            }}
                          >
                            1
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #eee",
                              color: "#000",
                            }}
                          >
                            ${parseFloat(user?.amountPaid).toFixed(2)}
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderBottom: "1px solid #eee",
                              color: "#000",
                            }}
                          >
                            ${parseFloat(user?.amountPaid).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr>
                          <td
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderTop: "1px solid #eee",
                              color: "#000",
                            }}
                          >
                            Subtotal
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderTop: "1px solid #eee",
                              color: "#000",
                            }}
                          >
                            ${parseFloat(user?.amountPaid).toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderTop: "1px solid #eee",
                              color: "#000",
                            }}
                          >
                            Total
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderTop: "1px solid #eee",
                              color: "#000",
                            }}
                          >
                            ${parseFloat(user?.amountPaid).toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              padding: "10px",
                              textAlign: "left",
                              borderTop: "1px solid #eee",
                              color: "#000",
                            }}
                          >
                            <strong>Total Amount Paid</strong>
                          </td>
                          <td
                            style={{
                              padding: "10px",
                              borderTop: "1px solid #eee",
                              color: "#000",
                            }}
                          >
                            <strong>
                              ${parseFloat(user?.amountPaid).toFixed(2)}{" "}
                              {user?.currency.toUpperCase()}
                            </strong>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <DialogFooter className="sm:justify-end">
                    <DialogClose asChild>
                      <div>
                        <IconButton text="Cancel" />
                      </div>
                    </DialogClose>
                    <div className="text-black" onClick={downloadAsPDF}>
                      <IconButton
                        text="Download"
                        icon={<RightArrow />}
                        isDownload
                      />
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPayment;
